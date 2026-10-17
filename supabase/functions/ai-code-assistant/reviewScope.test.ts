import { checkEditScope } from './reviewScope.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test('blocks unrequested form additions inside a scoped copy edit', () => {
  const result = checkEditScope({
    taskType: 'surgical_edit',
    targetFile: '/src/project-components/home/CinematicHero.tsx',
    existingFiles: ['/src/project-components/home/CinematicHero.tsx'],
    originalFiles: {
      '/src/project-components/home/CinematicHero.tsx': 'export default function Hero(){return <section><p>Hero eyebrow</p></section>}',
    },
    patchFiles: {
      '/src/project-components/home/CinematicHero.tsx': 'export default function Hero(){return <section><p>Product designer</p><form><input /></form></section>}',
    },
    userPrompt: 'Change only the hero eyebrow copy.',
  });

  assert(result.inScope === false, 'Expected the side-effect candidate to be out of scope.');
  assert(result.blockAutoApply === true, 'Expected auto-apply to be blocked.');
  assert(result.reason?.includes('unrequested side effects') === true, 'Expected a side-effect reason.');
});

Deno.test('allows an explicitly requested contact form', () => {
  const result = checkEditScope({
    taskType: 'surgical_edit',
    targetFile: '/src/project-components/home/CinematicHero.tsx',
    existingFiles: ['/src/project-components/home/CinematicHero.tsx'],
    originalFiles: {
      '/src/project-components/home/CinematicHero.tsx': 'export default function Hero(){return <section><p>Hero eyebrow</p></section>}',
    },
    patchFiles: {
      '/src/project-components/home/CinematicHero.tsx': 'export default function Hero(){return <section className="hero"><p>Contact us</p><form><label>Email<input aria-label="Email" /></label><button type="submit">Send</button></form></section>}',
    },
    userPrompt: 'Add a contact form to the hero.',
  });

  assert(result.inScope === true, `Expected the explicitly requested form to remain in scope: ${JSON.stringify(result)}`);
});

Deno.test('blocks form and input additions in a visual navbar edit', () => {
  const result = checkEditScope({
    taskType: 'surgical_edit',
    targetFile: '/src/project-components/site/SiteNav.tsx',
    existingFiles: ['/src/project-components/site/SiteNav.tsx'],
    originalFiles: {
      '/src/project-components/site/SiteNav.tsx': 'export default function SiteNav(){return <nav><a href="/">Home</a></nav>}',
    },
    patchFiles: {
      '/src/project-components/site/SiteNav.tsx': 'export default function SiteNav(){return <nav><a href="/">Home</a><form><input /></form></nav>}',
    },
    userPrompt: 'Change the navbar to a floating horizontal cascade.',
  });

  assert(result.inScope === false, 'Expected visual navbar side effects to be out of scope.');
  assert(result.blockAutoApply === true, 'Expected auto-apply to be blocked.');
});

Deno.test('edit policy: extra files and additions are advisory without "only"', () => {
  const result = checkEditScope({
    taskType: 'surgical_edit',
    targetFile: '/src/pages/Home.tsx',
    existingFiles: ['/src/pages/Home.tsx'],
    originalFiles: { '/src/pages/Home.tsx': 'export default function Home(){return <main><section><h1>Welcome home to our studio</h1></section></main>}' },
    patchFiles: {
      '/src/pages/Home.tsx': 'export default function Home(){return <main><section><h1>Welcome home to our studio</h1><form><input /></form></section></main>}',
      '/src/project-components/A.tsx': 'export default function A(){return null}',
      '/src/project-components/B.tsx': 'export default function B(){return null}',
      '/src/project-components/C.tsx': 'export default function C(){return null}',
    },
    userPrompt: 'Make the hero section better.',
  });
  assert(result.inScope === true, 'Expected advisory-only scope result.');
  assert(result.blockAutoApply === false, 'Expected auto-apply to stay allowed.');
  assert((result.advisories ?? []).length >= 2, 'Expected advisories for files and additions.');
});
