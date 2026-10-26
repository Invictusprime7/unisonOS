import { describe, it, expect } from 'vitest';
import { buildAICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';

const base = Object.freeze({
  '/src/pages/Home.tsx': 'export default function Home(){return <main>Old</main>}',
  '/src/pages/About.tsx': 'export default function About(){return <main/>}',
});

describe('AICandidateChangeSet', () => {
  it('includes every non-file proposal in the candidate identity', () => {
    const input = { aiFiles: {}, baseFiles: base, resolveDependencies: false };
    const unchanged = buildAICandidateChangeSet(input).changeSet.id;
    const proposals = [
      { backendOps: [{ type: 'requireCapability' as const, capability: 'auth' }] },
      { bindingOps: [{ type: 'bindIntent' as const, elementId: 'login', intent: 'auth.login' }] },
      { presentationOps: [{ type: 'setMotionBudget' as const, motionBudget: 'restrained' as const }] },
      { playgroundOps: [{ type: 'updatePage' as const, pageId: 'home', payload: { title: 'Home' } }] },
    ];
    const ids = proposals.map((proposal) => buildAICandidateChangeSet({ ...input, ...proposal }).changeSet.id);
    expect(ids).not.toContain(unchanged);
    expect(new Set(ids).size).toBe(proposals.length);
  });
  it('applies in memory without mutating the committed base', () => {
    const r = buildAICandidateChangeSet({
      aiFiles: { '/src/pages/Home.tsx': 'export default function Home(){return <main>New</main>}' },
      baseFiles: base, targetPages: ['home'], resolveDependencies: false,
    });
    expect(base['/src/pages/Home.tsx']).toContain('Old');
    expect(r.candidateFiles['/src/pages/Home.tsx']).toContain('New');
    expect(r.changeSet.fileOps).toEqual([expect.objectContaining({ type: 'replace', path: '/src/pages/Home.tsx' })]);
  });

  it('classifies create/delete and is deterministic', () => {
    const input = {
      aiFiles: { '/src/components/local/Hero.tsx': 'export const Hero=()=>null' },
      deletions: ['/src/pages/About.tsx'], baseFiles: base, resolveDependencies: false,
    };
    const a = buildAICandidateChangeSet(input);
    const b = buildAICandidateChangeSet(input);
    expect(a.changeSet.id).toBe(b.changeSet.id);
    expect(a.changeSet.fileOps.map((o) => o.type)).toEqual(['create', 'delete']);
    expect(a.candidateFiles['/src/pages/About.tsx']).toBeUndefined();
  });

  it('drops no-op writes', () => {
    const r = buildAICandidateChangeSet({ aiFiles: { ...base }, baseFiles: base, resolveDependencies: false });
    expect(r.changeSet.fileOps).toHaveLength(0);
  });

  it('adds newly imported npm packages to the site manifest and requested dependencies', () => {
    const r = buildAICandidateChangeSet({
      aiFiles: {
        '/src/pages/Home.tsx': "import Chart from '@new-scope/chart/feature'; export default function Home(){return <Chart/>}",
      },
      baseFiles: {
        ...base,
        '/package.json': JSON.stringify({ dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' } }),
      },
    });
    const packageJson = JSON.parse(r.candidateFiles['/package.json']);

    expect(packageJson.dependencies['@new-scope/chart']).toBeTruthy();
    expect(r.changeSet.requestedDependencies).toContain('@new-scope/chart');
    expect(r.changeSet.dependencyGraphFingerprint).toMatch(/^site-deps-v1-/);
    expect(r.changeSet.fileOps).toContainEqual(expect.objectContaining({ path: '/package.json', type: 'replace' }));
  });

  it('includes typed route operations in candidate identity', () => {
    const common = {
      aiFiles: { '/src/pages/Pricing.tsx': 'export default function Pricing(){return <main>Pricing</main>}' },
      baseFiles: base,
      resolveDependencies: false,
    };
    const first = buildAICandidateChangeSet({
      ...common,
      routeOps: [{ type: 'add_page', pageId: 'pricing', title: 'Pricing', route: '/pricing' }],
    });
    const second = buildAICandidateChangeSet({
      ...common,
      routeOps: [{ type: 'add_page', pageId: 'plans', title: 'Plans', route: '/plans' }],
    });

    expect(first.changeSet.routeOps).toEqual([
      { type: 'add_page', pageId: 'pricing', title: 'Pricing', route: '/pricing' },
    ]);
    expect(first.changeSet.id).not.toBe(second.changeSet.id);
  });

  it('keeps freeform navigation and slotted interaction rewrites in the candidate', () => {
    const source = '<a data-ut-slot="navbar.primary" data-ut-intent="nav.goto" href="#/about">About</a>';
    const r = buildAICandidateChangeSet({
      aiFiles: { '/src/components/Navbar.tsx': source.replace('#/about', '#/contact').replace('nav.goto', 'nav.contact') },
      baseFiles: { '/src/components/Navbar.tsx': source },
      resolveDependencies: false,
    });
    expect(r.refused).toEqual([]);
    expect(r.changeSet.fileOps).toEqual([expect.objectContaining({ type: 'replace', path: '/src/components/Navbar.tsx' })]);
  });
});
