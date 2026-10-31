import { it, vi } from 'vitest';
vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));
import { authorSitePages } from '@/services/launch/siteAuthoringOrchestrator';
const base = {
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Old</main>}',
  '/src/pages/About.tsx': 'export default function About(){return <main>About</main>}',
};
const good = (path: string, text: string) => ({ data: { content: JSON.stringify({ summary: text, fileOps: [{ type: 'replace', path, content: `export default function P(){return <main>${text}</main>}` }] }) }, error: null });
const bad = (path: string) => ({ data: { content: JSON.stringify({ summary: 'x', fileOps: [{ type: 'replace', path, content: "import X from './Nope';\nexport default function P(){return <X/>}" }] }) }, error: null });
it('debug', async () => {
  const freshPages = [
    { pageId: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx', role: 'home' },
    { pageId: 'blog', title: 'Journal', route: '/journal', filePath: '/src/pages/Blog.tsx', role: 'blog' },
    { pageId: 'contact', title: 'Contact', route: '/contact', filePath: '/src/pages/Contact.tsx', role: 'contact' },
  ];
  const invoke = vi.fn(async (input: { messages: Array<{ content: string }> }) => {
    const req = JSON.parse(input.messages[0].content);
    return req.page.role === 'blog' ? bad(req.page.filePath) : good(req.page.filePath, req.page.title);
  });
  const result = await authorSitePages({ pages: freshPages, homePageId: 'home', designContext: null, businessName: 'Fail fast', files: base, concurrency: 1, invoke: invoke as never, commitPage: async files => ({ files }) });
  console.log('OUTCOMES', JSON.stringify(result.outcomes.map(o => ({ id: o.page.pageId, status: o.status, reason: o.reason, errors: o.errors })), null, 1));
}, 30000);
