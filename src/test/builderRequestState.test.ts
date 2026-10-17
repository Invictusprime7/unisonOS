import { describe, expect, it } from 'vitest';
import { assertBuilderRequestState, captureBuilderRequestState } from '@/services/builder/builderRequestState';

const state = () => ({ files: { '/src/pages/Home.tsx': 'home' }, revisionId: 'r1', projectId: 'p1', businessId: 'b1' });

describe('current Builder request boundary', () => {
  it('captures source independently of subsequent live mutations', () => {
    const live = state();
    const captured = captureBuilderRequestState(live);
    live.files['/src/pages/Home.tsx'] = 'new';
    expect(captured.files['/src/pages/Home.tsx']).toBe('home');
    expect(() => assertBuilderRequestState(captured, live)).toThrow('latest version');
  });
  it('refuses a newer accepted revision even on an unchanged target', () => {
    expect(() => assertBuilderRequestState(state(), { ...state(), revisionId: 'r2' })).toThrow('latest version');
  });
  it('refuses a project switch before dispatch', () => {
    expect(() => assertBuilderRequestState(state(), { ...state(), projectId: 'p2' })).toThrow('active project changed');
  });
  it('detects file creation with no revision advance', () => {
    expect(() => assertBuilderRequestState(state(), { ...state(), files: { ...state().files, '/src/pages/New.tsx': 'new' } })).toThrow('latest version');
  });
  it('accepts the same canonical state', () => {
    expect(() => assertBuilderRequestState(state(), state())).not.toThrow();
  });
});