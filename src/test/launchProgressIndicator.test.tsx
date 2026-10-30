import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaunchStageTimeline } from '@/components/onboarding/wizard/LaunchStageTimeline';
import type { LaunchRunSnapshot } from '@/services/launch/launchRun';

afterEach(() => { cleanup(); vi.useRealTimers(); });

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
    render(<LaunchStageTimeline snapshot={snapshot} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });

  it('advances only when the canonical stage completes', () => {
    const { rerender } = render(<LaunchStageTimeline snapshot={snapshot} />);
    rerender(<LaunchStageTimeline snapshot={{ ...snapshot, stages: snapshot.stages.map(stage => stage.name === 'app-build' ? { ...stage, status: 'done' } : stage) }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '6');
  });
});