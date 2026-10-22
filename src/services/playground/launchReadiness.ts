/**
 * Launch readiness — the ONE launch-task model shared by the post-launch
 * dialog (compact projection) and Playground → Launch (detailed surface).
 *
 * Pure: derives task status from real system state (saved resources,
 * Business Profile Resource, enabled capabilities, setup progress, publish
 * blockers). Nothing here stores a "completed" flag; a machine-verifiable
 * task turns ready only when the underlying state is actually ready.
 */

export type LaunchTaskDomain =
  | 'resource'
  | 'business-profile'
  | 'operation'
  | 'integration'
  | 'publish'
  | 'analytics'
  | 'seo';

export type LaunchTaskPriority = 'required' | 'recommended' | 'optional';
export type LaunchTaskStatus = 'ready' | 'needs_action' | 'pending_verification' | 'blocked';

export interface LaunchTask {
  id: string;
  title: string;
  description: string;
  domain: LaunchTaskDomain;
  priority: LaunchTaskPriority;
  status: LaunchTaskStatus;
  /** True when status is proven by system state, not by a user tick. */
  verifiable: boolean;
  target?: {
    playgroundSection?: 'assets' | 'business' | 'launch' | 'calendars' | 'readiness';
    resourceKey?: string;
    operationKey?: string;
    setupStepId?: string;
  };
  dependencyIds?: string[];
}

export interface LaunchReadinessInput {
  /** Durable confirmed site + project identity has been hydrated. */
  siteConnected?: boolean;
  capabilities?: string[];
  systemType?: string | null;
  /** Resource types the generated site actually renders, with saved counts. */
  usedResources?: { key: string; label: string; count: number }[];
  businessProfile?: Record<string, unknown> | null;
  notificationEmail?: string | null;
  customDomain?: string | null;
  setupSteps?: { id: string; status: string }[];
  /** Required-for-publish blockers from resolvePlaygroundControlPlane(). */
  publishBlockers?: number;
}

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

export function hasCapability(input: Pick<LaunchReadinessInput, 'capabilities' | 'systemType'>, ...ids: string[]): boolean {
  const caps = new Set((input.capabilities ?? []).map((c) => c.toLowerCase()));
  if (ids.some((id) => caps.has(id))) return true;
  const sys = (input.systemType ?? '').toLowerCase();
  if (ids.includes('booking') && sys === 'booking') return true;
  if ((ids.includes('commerce') || ids.includes('payments')) && sys === 'store') return true;
  return false;
}

export function deriveLaunchTasks(input: LaunchReadinessInput): LaunchTask[] {
  const tasks: LaunchTask[] = [];
  const step = (id: string) => input.setupSteps?.find((s) => s.id === id)?.status;
  const profile = input.businessProfile ?? {};

  const missing = (['name', 'email', 'phone'] as const).filter((k) => blank(profile[k]));
  if (input.siteConnected === false) {
    tasks.push({
      id: 'site-connection',
      title: 'Connect confirmed site',
      description: 'Confirm a launch so this Playground can read and configure the saved site.',
      domain: 'publish',
      priority: 'required',
      status: 'blocked',
      verifiable: true,
      target: { playgroundSection: 'readiness' },
    });
  }
  tasks.push({
    id: 'business-profile',
    title: 'Complete business profile',
    description: missing.length ? `Missing: ${missing.join(', ')}` : 'Name, email and phone are saved',
    domain: 'business-profile',
    priority: 'required',
    status: missing.length ? 'needs_action' : 'ready',
    verifiable: true,
    target: { playgroundSection: 'assets', resourceKey: 'business-profile' },
  });

  for (const r of input.usedResources ?? []) {
    tasks.push({
      id: `resource:${r.key}`,
      title: r.count ? `${r.label}` : `Add ${r.label.toLowerCase()}`,
      description: r.count ? `${r.count} saved and shown on your site` : 'Your site shows this section but nothing is saved yet',
      domain: 'resource',
      priority: 'recommended',
      status: r.count ? 'ready' : 'needs_action',
      verifiable: true,
      target: { playgroundSection: 'assets', resourceKey: r.key },
    });
  }

  if (hasCapability(input, 'contact', 'lead-capture', 'quoting', 'newsletter')) {
    const email = input.notificationEmail ?? (profile.notificationEmail as string | undefined);
    tasks.push({
      id: 'operation:leads',
      title: 'Receive new enquiries',
      description: blank(email) ? 'Add a notification email so form submissions reach you' : `Enquiries go to ${email}`,
      domain: 'operation',
      priority: 'required',
      status: blank(email) ? 'needs_action' : 'ready',
      verifiable: true,
      target: { playgroundSection: 'business', operationKey: 'leads' },
    });
  }

  if (hasCapability(input, 'booking')) {
    const s = step('booking_calendar');
    tasks.push({
      id: 'operation:booking',
      title: 'Configure booking',
      description: 'Set availability, service durations and buffers',
      domain: 'operation',
      priority: 'required',
      status: s === 'completed' ? 'pending_verification' : 'needs_action',
      verifiable: false,
      target: { playgroundSection: 'launch', setupStepId: 'booking_calendar', operationKey: 'calendar' },
    });
  }

  if (hasCapability(input, 'commerce', 'payments', 'donation')) {
    const s = step('payments');
    tasks.push({
      id: 'integration:payments',
      title: 'Connect payments',
      description: 'Checkout stays blocked until a payment account is connected',
      domain: 'integration',
      priority: 'required',
      status: s === 'completed' ? 'pending_verification' : 'blocked',
      verifiable: false,
      target: { playgroundSection: 'launch', setupStepId: 'payments' },
    });
  }

  const blockers = input.publishBlockers;
  const siteDisconnected = input.siteConnected === false;
  tasks.push({
    id: 'publish',
    title: 'Ready to publish',
    description: siteDisconnected
      ? 'Connect a confirmed site before validating publication requirements'
      : blockers === undefined ? 'Not checked yet' : blockers ? `${blockers} button or form connection${blockers === 1 ? '' : 's'} still need fixing` : 'Every required connection works',
    domain: 'publish',
    priority: 'required',
    status: siteDisconnected ? 'blocked' : blockers === undefined ? 'pending_verification' : blockers ? 'blocked' : 'ready',
    verifiable: true,
    target: { playgroundSection: 'readiness' },
    dependencyIds: tasks.filter((t) => t.priority === 'required').map((t) => t.id),
  });

  tasks.push({
    id: 'integration:domain',
    title: 'Connect a custom domain',
    description: input.customDomain ? `Live at ${input.customDomain}` : 'Use your own web address',
    domain: 'integration',
    priority: 'optional',
    status: input.customDomain ? 'ready' : 'needs_action',
    verifiable: true,
    target: { playgroundSection: 'launch', setupStepId: 'domain' },
  });

  for (const [id, domain, title] of [['seo', 'seo', 'Review search listing'], ['analytics', 'analytics', 'Set up analytics']] as const) {
    tasks.push({
      id, title, domain,
      description: domain === 'seo' ? 'Page titles, descriptions and sharing previews' : 'Track visitors and conversions',
      priority: 'optional',
      status: step(id) === 'completed' ? 'ready' : 'needs_action',
      verifiable: false,
      target: { playgroundSection: 'launch', setupStepId: id },
    });
  }

  const rank: Record<LaunchTaskPriority, number> = { required: 0, recommended: 1, optional: 2 };
  return tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
}

export function summarizeLaunchTasks(tasks: LaunchTask[]) {
  const ready = tasks.filter((t) => t.status === 'ready').length;
  return { ready, total: tasks.length, percent: tasks.length ? Math.round((ready / tasks.length) * 100) : 0 };
}
