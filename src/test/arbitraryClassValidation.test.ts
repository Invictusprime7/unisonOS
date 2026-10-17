import { describe, expect, it } from 'vitest';
import { invalidArbitraryClasses } from '@/services/builder/arbitraryClassValidation';
import { prepareAICandidate } from '@/services/builder/aiCandidateGates';

const page = (classes: string) => `export default function Page(){return <main className=${JSON.stringify(classes)}/>}`;
describe('candidate arbitrary CSS validation', () => {
  it.each(['w-[var(--ut-container)]', 'grid-cols-[repeat(2,minmax(0,1fr))]', 'shadow-[0_0_var(--ut-density-gap)_hsl(var(--primary))]', '[&>td]:text-left'])('allows complete token/structural CSS %s', classes => {
    expect(invalidArbitraryClasses(page(classes))).toEqual([]);
  });
  it.each(['w-[var(--ut-container]', 'w-[var(primary)]', 'grid-cols-[repeat(2, minmax(0,1fr))]', 'text-[undefined]', 'w-[var(--ut-container);color:red]'])('rejects uncompileable value %s', classes => {
    expect(invalidArbitraryClasses(page(classes)).length).toBeGreaterThan(0);
  });
  it('rejects dynamic class interpolation that Tailwind cannot compile', () => {
    expect(invalidArbitraryClasses('export default function Page(){return <main className={`w-[${size}]`}/>}').length).toBe(1);
  });
  it('blocks invalid classes before accepting files or changing the base', async () => {
    const base = { '/src/pages/Home.tsx': page('w-full') };
    const result = await prepareAICandidate({ baseFiles: base, aiFiles: { '/src/pages/Home.tsx': page('w-[var(--ut-container]') } });
    expect(result.ok).toBe(false);
    expect(result.gates.failures.some(failure => failure.gate === 'css-value')).toBe(true);
    expect(base['/src/pages/Home.tsx']).toBe(page('w-full'));
  });
});