import { describe, it, expect } from 'vitest';
import { createUnisonBuilderContext } from '@/services/unisonBuilderConnector';
import { dispatchBuilderOperation, BuilderToolRefusal } from '@/services/unisonBuilderToolDispatch';

const files = {
  '/src/pages/Home.tsx': 'export default () => <img src="a.jpg" />',
  '/src/pages/About.tsx': 'export default () => <img src="a.jpg" />',
  '/src/index.css': ':root {\n  --primary: 0 0% 0%;\n}',
  '/src/App.tsx': 'x',
};
const ctx = (extra = {}) => createUnisonBuilderContext({ files, projectId: 'p1', sourceTargets: ['/src/pages/Home.tsx'], ...extra });
const agent = { files, projectId: 'p1' };

describe('enforced builder tool dispatch', () => {
  it('runs an in-scope proposal through the existing operation', async () => {
    const r = await dispatchBuilderOperation(ctx(), agent, 'swap_image', '/src/pages/Home.tsx', 'a.jpg', 'b.jpg');
    expect(r?.files['/src/pages/Home.tsx']).toContain('b.jpg');
  });
  it('refuses files outside the request scope', async () => {
    await expect(dispatchBuilderOperation(ctx(), agent, 'swap_image', '/src/pages/About.tsx', 'a.jpg', 'b.jpg')).rejects.toBeInstanceOf(BuilderToolRefusal);
  });
  it('refuses another project context', async () => {
    await expect(dispatchBuilderOperation(ctx(), { ...agent, projectId: 'p2' }, 'inspect_routes')).rejects.toThrow(/another project/);
  });
  it('refuses unknown intents before resolving bindings', async () => {
    await expect(dispatchBuilderOperation(ctx(), agent, 'propose_bind_intent', {} as never, 'totally.fake_intent')).rejects.toThrow(/Unknown canonical intent/);
  });
  it('refuses non-canonical theme tokens and allows canonical ones', async () => {
    await expect(dispatchBuilderOperation(ctx(), agent, 'set_theme_tokens', { '--brand-x': 'red' })).rejects.toThrow(/canonical design token/);
    const ok = await dispatchBuilderOperation(ctx(), agent, 'set_theme_tokens', { '--primary': '10 10% 10%' });
    expect(ok?.files['/src/index.css']).toContain('10 10% 10%');
  });
  it('refuses editing a record other than the selected one', async () => {
    const c = ctx({ selection: { resourceMark: 'services:1#price', componentPath: '/src/pages/Home.tsx' } });
    await expect(dispatchBuilderOperation(c, { ...agent, businessId: 'b' }, 'update_resource_field', 'services:2#price', 5)).rejects.toThrow(/selected element/);
  });
  it('refuses record writes when the selection is page content', async () => {
    const c = ctx({ selection: { componentPath: '/src/pages/Home.tsx' } });
    await expect(dispatchBuilderOperation(c, { ...agent, businessId: 'b' }, 'update_resource_field', 'services:1#price', 5)).rejects.toThrow(/not backed by a saved record/);
  });
});

import { dispatchOnLatestRevision } from '@/services/unisonBuilderToolDispatch';

describe('stale-session edits', () => {
  const stale = () => createUnisonBuilderContext({ files, projectId: 'p1', revisionId: 'r1', sourceTargets: ['/src/pages/Home.tsx'] });
  const base = { files, projectId: 'p1', revisionId: 'r1' };
  it('record edits ignore the page version', async () => {
    const c = createUnisonBuilderContext({ projectId: 'p1', revisionId: 'r1', businessId: 'b' });
    await expect(dispatchBuilderOperation(c, { files, projectId: 'p1', businessId: 'b', revisionId: 'r2' }, 'list_resources')).resolves.toBeDefined();
  });
  it('page edits replay on the newest version when the target is unchanged', async () => {
    const latest = { files: { ...files, '/src/pages/About.tsx': 'newer work' }, projectId: 'p1', revisionId: 'r2' };
    const out = await dispatchOnLatestRevision(stale(), base, latest, 'swap_image', ['/src/pages/Home.tsx', 'a.jpg', 'b.jpg']);
    expect(out.status).toBe('applied');
    if (out.status === 'applied') { expect(out.rebased).toBe(true); expect(out.revisionId).toBe('r2'); }
  });
  it('asks before applying when the same page changed since the session began', async () => {
    const latest = { files: { ...files, '/src/pages/Home.tsx': 'export default () => <img src="a.jpg" /> /* newer */' }, projectId: 'p1', revisionId: 'r2' };
    const out = await dispatchOnLatestRevision(stale(), base, latest, 'swap_image', ['/src/pages/Home.tsx', 'a.jpg', 'b.jpg']);
    expect(out.status).toBe('needs-confirmation');
    const ok = await dispatchOnLatestRevision(stale(), base, latest, 'swap_image', ['/src/pages/Home.tsx', 'a.jpg', 'b.jpg'], { confirmOverlap: true });
    expect(ok.status === 'applied' && ok.result?.files['/src/pages/Home.tsx']).toContain('newer');
  });
  it('asks to re-select when the element is gone on the newest version', async () => {
    const latest = { files: { ...files, '/src/pages/Home.tsx': 'no image' }, projectId: 'p1', revisionId: 'r2' };
    const out = await dispatchOnLatestRevision(stale(), base, latest, 'swap_image', ['/src/pages/Home.tsx', 'a.jpg', 'b.jpg'], { confirmOverlap: true });
    expect(out.status).toBe('needs-confirmation');
  });
});
