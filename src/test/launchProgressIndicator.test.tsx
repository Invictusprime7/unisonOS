import { afterEach, describe, expect, it, vi } from 'vitest';
import { completedLaunchSteps } from '@/components/onboarding/wizard/LaunchStageTimeline';
import type { LaunchRunSnapshot } from '@/services/launch/launchRun';

afterEach(() => { vi.useRealTimers(); });

const snapshot: LaunchRunSnapshot = {
  stages: [
    { name: 'plan', label: 'Plan', status: 'done' },
    { name: 'contract', label: 'Contract', status: 'done' },
    { name: 'app-build', label: 'Design', status: 'active', startedAt: 1000 },
    { name: 'preflight', label: 'Check', status: 'pending' },
    { name: 'commit', label: 'Save', status: 'pending' },
    { name: 'handoff', label: 'Open', status: 'pending' },
  ],
  activeStage: 'app-build', degradations: [], fatal: null, cancelled: false,
};

describe('Launch completion evidence', () => {
  it('does not turn elapsed designing time into completed steps', () => {
    vi.useFakeTimers();
    expect(completedLaunchSteps(snapshot)).toBe(2);
    vi.advanceTimersByTime(60_000);
    expect(completedLaunchSteps(snapshot)).toBe(2);
  });

  it('advances only when the canonical stage completes', () => {
    const next: LaunchRunSnapshot = { ...snapshot, stages: snapshot.stages.map(stage => stage.name === 'app-build' ? { ...stage, status: 'done' } : stage) };
    expect(completedLaunchSteps(next)).toBe(3);
    expect(next.stages).toHaveLength(6);
  });
});