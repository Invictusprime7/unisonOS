import { describe, it, expect } from 'vitest';
import { deriveLaunchTasks, summarizeLaunchTasks } from '@/services/playground/launchReadiness';
import { buildSiteSetupPlan } from '@/services/siteSetupPlan';

describe('launch readiness', () => {
  it('derives status from real state, not ticks', () => {
    const tasks = deriveLaunchTasks({
      capabilities: ['contact'],
      businessProfile: { name: 'SPARK', email: 'a@b.co', phone: '1' },
      usedResources: [{ key: 'portfolio', label: 'Portfolio', count: 0 }],
      publishBlockers: 2,
    });
    expect(tasks.find((t) => t.id === 'business-profile')?.status).toBe('ready');
    expect(tasks.find((t) => t.id === 'resource:portfolio')?.status).toBe('needs_action');
    expect(tasks.find((t) => t.id === 'operation:leads')?.status).toBe('needs_action');
    expect(tasks.find((t) => t.id === 'publish')?.status).toBe('blocked');
    expect(tasks.some((t) => t.id === 'operation:booking')).toBe(false);
    expect(summarizeLaunchTasks(tasks).ready).toBe(1);
  });

  it('never marks unverifiable payments ready from a manual tick', () => {
    const tasks = deriveLaunchTasks({ systemType: 'store', setupSteps: [{ id: 'payments', status: 'completed' }] });
    expect(tasks.find((t) => t.id === 'integration:payments')?.status).toBe('pending_verification');
  });

  it('blocks publication until the confirmed site and project are connected', () => {
    const tasks = deriveLaunchTasks({
      siteConnected: false,
      businessProfile: { name: 'SPARK', email: 'a@b.co', phone: '1' },
      publishBlockers: 0,
    });
    expect(tasks.find((task) => task.id === 'site-connection')?.status).toBe('blocked');
    expect(tasks.find((task) => task.id === 'publish')?.status).toBe('blocked');
    expect(tasks.find((task) => task.id === 'publish')?.description).toContain('Connect a confirmed site');
  });

  it('setup plan follows capabilities', () => {
    const ids = buildSiteSetupPlan({ systemType: 'agency', capabilities: ['contact'] }).map((s) => s.id);
    expect(ids).not.toContain('booking_calendar');
    expect(ids).not.toContain('payments');
    expect(buildSiteSetupPlan({ capabilities: ['booking'] }).map((s) => s.id)).toContain('booking_calendar');
  });
});
