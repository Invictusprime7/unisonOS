import { describe, expect, it } from 'vitest';
import { selectSourceKnowledge, selectSourceKnowledgeWithReport } from '@/services/builder/sourceKnowledgeContext';
import { shrinkBuilderTurnPayload } from '@/services/builderPayloadBudget';
import { aiComposerRequestSchema } from '@/contracts/aiComposerContract';

describe('source knowledge for authoring and complex repairs', () => {
  it('reports missing targets, whole-file omissions and unresolved local imports', () => {
    const result = selectSourceKnowledgeWithReport({
      '/src/page.ts': "import './absent';",
      '/src/large.ts': 'x'.repeat(60001),
      '/src/index.css': 'x'.repeat(400),
    }, ['/src/page.ts', '/src/large.ts', '/src/missing.ts'], 100);
    expect(result.completeTargets).toBe(false);
    expect(result.omitted).toEqual(expect.arrayContaining([
      { path: '/src/large.ts', reason: 'per-file-limit' },
      { path: '/src/missing.ts', reason: 'missing' },
      { path: '/src/index.css', reason: 'transport-budget' },
    ]));
    expect(result.unresolvedImports).toContainEqual({ path: '/src/page.ts', specifier: './absent' });
    expect(result.encodedBytes).toBeLessThanOrEqual(100);
    expect(result.files['/src/page.ts']).toBe("import './absent';");
  });
  it('includes theme and transitive canonical APIs without unrelated pages or cycles', () => {
    const files = {
      '/src/pages/Home.tsx': "import { Card } from '@/unison/ui'; export default Card;",
      '/src/unison/ui/index.ts': "export { Card } from './Card';",
      '/src/unison/ui/Card.tsx': "import './index'; export const Card = () => <div/>;",
      '/src/index.css': ':root { --primary: 10 20% 30%; }',
      '/package.json': '{"dependencies":{"react":"19"}}',
      '/src/pages/Unrelated.tsx': 'not relevant',
    };
    const selected = selectSourceKnowledge(files, ['/src/pages/Home.tsx']);
    expect(selected['/src/unison/ui/Card.tsx']).toBe(files['/src/unison/ui/Card.tsx']);
    expect(selected['/src/index.css']).toBe(files['/src/index.css']);
    expect(selected['/src/pages/Unrelated.tsx']).toBeUndefined();
  });

  it('bounds encoded multilingual context and never cuts source files', () => {
    const files = {
      '/src/pages/Home.tsx': 'target',
      '/src/index.css': '界"\\'.repeat(9000),
      '/src/project-components/site/Nav.tsx': 'n'.repeat(60001),
    };
    const selected = selectSourceKnowledge(files, ['/src/pages/Home.tsx'], 5000);
    expect(selected).toEqual({ '/src/pages/Home.tsx': 'target' });
    expect(new TextEncoder().encode(JSON.stringify(JSON.stringify(selected))).byteLength).toBeLessThanOrEqual(5000);
  });

  it('shrinks large Composer context without breaking its JSON or target source', () => {
    const request = {
      task: 'site_page_author',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Preserve the visual identity', routes: [],
      files: { '/src/pages/Home.tsx': 'target', '/src/index.css': 'x'.repeat(50000) },
      previousResponse: 'x'.repeat(50000),
    };
    const original = JSON.stringify(request);
    const result = shrinkBuilderTurnPayload({ mode: 'site-page-author', messages: [{ role: 'user', content: original }] }, 8000);
    const decoded = JSON.parse(result.payload.messages[0].content);
    expect(aiComposerRequestSchema.safeParse(decoded).success).toBe(true);
    expect(decoded.files['/src/pages/Home.tsx']).toBe('target');
    expect(result.finalBytes).toBeLessThanOrEqual(8000);
    expect(JSON.stringify(request)).toBe(original);
  });

  it('shrinks source-project turns without truncating the request or dropping build foundations', () => {
    const request = {
      task: 'source_project_author',
      page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
      brief: 'Write a complete bakery site',
      files: {
        '/package.json': '{"dependencies":{"react":"^18.3.1"}}',
        '/index.html': '<div id="root"></div>',
        '/src/App.tsx': 'export default function App() { return null; }',
        '/src/main.tsx': "import App from './App';",
        '/src/index.css': '@import "tailwindcss";',
        '/src/pages/Home.tsx': 'export default function Home() { return <main />; }',
        '/src/pages/About.tsx': 'a'.repeat(20_000),
        '/src/components/Heavy.tsx': 'b'.repeat(20_000),
      },
      sourceTargets: ['/src/pages/Home.tsx'],
      routes: [],
    };
    const original = JSON.stringify(request);
    const result = shrinkBuilderTurnPayload({
      mode: 'source-project-author',
      messages: [{ role: 'user', content: original }],
    }, 8_000);
    const decoded = JSON.parse(result.payload.messages[0].content);

    expect(aiComposerRequestSchema.safeParse(decoded).success).toBe(true);
    expect(decoded.files['/package.json']).toBe(request.files['/package.json']);
    expect(decoded.files['/src/App.tsx']).toBe(request.files['/src/App.tsx']);
    expect(decoded.files['/src/pages/Home.tsx']).toBe(request.files['/src/pages/Home.tsx']);
    expect(result.finalBytes).toBeLessThanOrEqual(8_000);
    expect(JSON.stringify(request)).toBe(original);
  });
});
