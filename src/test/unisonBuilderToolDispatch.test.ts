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
    await expect(dispatchBuilderOperation(ctx(), agent, 'propose_bind_intent', {} as never, 'nav.goto_page')).rejects.toThrow(/Unknown canonical intent/);
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
