import { describe, expect, it } from 'vitest';
import { normalizeWizardThemeTokens } from '@/utils/wizardThemeTokenNormalizer';
import { runFullPreflight, runFullPreflightSteps } from '@/services/runFullPreflight';

describe('Stage 4b role-aware semantic finalization', () => {
  it('preserves the surface/foreground contrast pair instead of flattening it', () => {
    const result = normalizeWizardThemeTokens({
      '/src/pages/Home.tsx':
        '<section className="bg-indigo-600 text-white p-8">CTA</section>',
    });
    const home = result.files['/src/pages/Home.tsx'];
    expect(home).toContain('bg-primary');
    expect(home).toContain('text-primary-foreground');
  });

  it('maps neutral surfaces to distinct semantic roles', () => {
    const result = normalizeWizardThemeTokens({
      '/src/pages/About.tsx': [
        '<div className="bg-white text-slate-900">card</div>',
        '<div className="bg-slate-100 text-gray-500">muted</div>',
      ].join('\n'),
    });
    const src = result.files['/src/pages/About.tsx'];
    expect(src).toContain('bg-card');
    expect(src).toContain('text-card-foreground');
    expect(src).toContain('bg-card text-card-foreground');
  });

  it('never rewrites media or URL values as colour tokens', () => {
    const source = "const hero = 'https://cdn.example.com/img/#ffffff.png';";
    const result = normalizeWizardThemeTokens({ '/src/pages/Gallery.tsx': source });
    expect(result.files['/src/pages/Gallery.tsx']).toBe(source);
    expect(result.residualLiterals.length).toBeGreaterThan(0);
  });

  it('is idempotent', () => {
    const input = {
      '/src/pages/Home.tsx': '<section className="bg-black text-white">hero</section>',
    };
    const once = normalizeWizardThemeTokens(input);
    const twice = normalizeWizardThemeTokens(once.files);
    expect(twice.files).toEqual(once.files);
    expect(twice.changedFiles).toEqual([]);
  });
});

describe('runFullPreflight modes', () => {
  const clean = {
    '/src/pages/Home.tsx': 'export default function Home() {\n  return <main>Home</main>;\n}\n',
  };

  it('reports mutation state in repair mode', () => {
    const result = runFullPreflight(clean);
    expect(result.mode).toBe('repair');
    expect(result.mutated).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('never mutates source in acceptance mode', () => {
    const result = runFullPreflight(clean, { mode: 'acceptance' });
    expect(result.mode).toBe('acceptance');
    expect(result.mutated).toBe(false);
    expect(result.files).toBe(clean);
  });

  it('yields during full-VFS syntax passes without changing the result', () => {
    const stepped = runFullPreflightSteps(clean);
    let yieldCount = 0;
    let step = stepped.next();
    while (!step.done) {
      yieldCount++;
      step = stepped.next();
    }

    expect(yieldCount).toBe(2);
    expect(step.value).toEqual(runFullPreflight(clean));
  });
});
