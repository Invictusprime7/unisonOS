import { describe, expect, it } from 'vitest';
import { canonicalCandidateOutput } from '@/services/builder/canonicalCandidateOutput';
import type { AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';

const candidate: AICandidateChangeSet = {
  id: 'prepared-edit', baseRevisionId: 'accepted-revision',
  provenance: { origin: 'builder', knowledgeVersion: '1' },
  fileOps: [
    { type: 'replace', path: '/src/pages/Home.tsx', content: 'export default function Home(){return <main title="Exact bytes">Home</main>}\n' },
    { type: 'create', path: '/src/components/Badge.tsx', content: 'export const Badge = () => <span />;' },
    { type: 'replace', path: '/package.json', content: '{"dependencies":{"react":"19"}}' },
    { type: 'delete', path: '/src/components/Old.tsx' },
  ],
  routeOps: [], targetPages: ['home'], attempt: 1,
};

describe('prepared canonical candidate projection', () => {
  it('preserves exact prepared bytes without parsing or repairing output', () => {
    expect(canonicalCandidateOutput(candidate).files['/src/pages/Home.tsx']).toBe(
      'export default function Home(){return <main title="Exact bytes">Home</main>}\n',
    );
  });
  it('keeps infrastructure operations already owned by the candidate', () => {
    expect(canonicalCandidateOutput(candidate).files['/package.json']).toBe('{"dependencies":{"react":"19"}}');
  });
  it('projects every create, replacement and deletion together', () => {
    const output = canonicalCandidateOutput(candidate);
    expect(Object.keys(output.files)).toEqual(['/src/pages/Home.tsx', '/src/components/Badge.tsx', '/package.json']);
    expect(output.deletions).toEqual(['/src/components/Old.tsx']);
  });
  it('does not mutate the candidate or share mutable containers', () => {
    const before = JSON.stringify(candidate);
    const output = canonicalCandidateOutput(candidate);
    output.files['/src/pages/Home.tsx'] = 'changed';
    output.deletions.push('/src/pages/Home.tsx');
    expect(JSON.stringify(candidate)).toBe(before);
    expect(canonicalCandidateOutput(candidate).deletions).toEqual(['/src/components/Old.tsx']);
  });
  it('keeps data-only candidates free of source operations', () => {
    expect(canonicalCandidateOutput({ ...candidate, fileOps: [] })).toEqual({ files: {}, deletions: [] });
  });
});