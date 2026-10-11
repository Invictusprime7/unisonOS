import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/intentExecutionLogger', () => ({
  logIntentExecution: vi.fn(async () => undefined),
  createLogEntryFromResult: vi.fn(() => ({})),
}));

vi.mock('@/services/intentBindingService', () => ({
  lookupIntentBinding: vi.fn(async () => ({ binding: null, workflow: null, recipes: [] })),
  recordBindingTriggered: vi.fn(async () => undefined),
}));

vi.mock('@/services/automationOrchestrator', () => ({
  dispatchAutomation: vi.fn(async () => ({ dispatched: false, eventName: null, recipesMatched: 0 })),
}));

vi.mock('@/services/componentGraphPersistence', () => ({
  logProjectGraphEvents: vi.fn(async () => undefined),
}));

vi.mock('@/runtime/intentFailureBus', () => ({
  emitIntentFailure: vi.fn(),
}));

import { executeIntent, type IntentManagers } from '@/runtime/intentExecutor';

function createManagers(overrides: Partial<IntentManagers> = {}): IntentManagers {
  return {
    overlay: {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn(() => false),
    },
    events: {
      emit: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    },
    ...overrides,
  };
}

describe('intentExecutor overlay fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads a bound document with a meaningful filename', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const result = await executeIntent('resume.download', {
      payload: { url: '/documents/alex-resume.pdf', filename: 'Alex Resume.pdf', mimeType: 'application/pdf' },
      managers: createManagers(),
    });

    expect(result.ok).toBe(true);
    expect(result._normalized).toBe('content.download');
    expect(result.data).toEqual(expect.objectContaining({ filename: 'Alex Resume.pdf' }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('blocks document downloads until a file is attached', async () => {
    const result = await executeIntent('content.download', { managers: createManagers() });
    expect(result.ok).toBe(false);
    expect(result.missing?.fields).toContain('url');
    expect(result.error?.code).toBe('MISSING_DOWNLOAD_URL');
  });

  it('opens the contact overlay when contact.submit is missing email', async () => {
    const managers = createManagers();
    const result = await executeIntent('contact.submit', {
      payload: { source: 'hero_cta' },
      managers,
    });

    expect(result.ok).toBe(true);
    expect(result.ui?.openModal).toBe('contact');
    expect(managers.overlay?.open).toHaveBeenCalledWith(
      'contact',
      expect.objectContaining({ source: 'hero_cta' }),
    );
  });

  it('opens the newsletter overlay when newsletter.subscribe is missing email', async () => {
    const managers = createManagers();
    const result = await executeIntent('newsletter.subscribe', {
      payload: { lists: ['launches'] },
      managers,
    });

    expect(result.ok).toBe(true);
    expect(result.ui?.openModal).toBe('newsletter');
    expect(managers.overlay?.open).toHaveBeenCalledWith(
      'newsletter',
      expect.objectContaining({ lists: ['launches'] }),
    );
  });

  it('opens the quote overlay when quote.request is missing required fields', async () => {
    const managers = createManagers();
    const result = await executeIntent('quote.request', {
      payload: { service: 'Consulting' },
      managers,
    });

    expect(result.ok).toBe(true);
    expect(result.ui?.openModal).toBe('quote');
    expect(managers.overlay?.open).toHaveBeenCalledWith(
      'quote',
      expect.objectContaining({ service: 'Consulting' }),
    );
  });

  it('submits quote requests through CRM when required fields are present', async () => {
    const submitLead = vi.fn(async () => ({ leadId: 'lead_123', pipelineId: 'pipe_123' }));
    const createDefaultPipeline = vi.fn(async () => ({
      id: 'pipe_123',
      name: 'Default Pipeline',
      stages: [],
    }));
    const managers = createManagers({
      crm: {
        submitLead,
        getPipeline: vi.fn(async () => null),
        createDefaultPipeline,
      },
    });

    const result = await executeIntent('quote.request', {
      payload: {
        name: 'Alex',
        email: 'alex@example.com',
        phone: '555-1111',
        service: 'Strategy',
        budget: '$5k-$10k',
        timeline: '30 days',
        description: 'Need a full project proposal',
      },
      managers,
    });

    expect(result.ok).toBe(true);
    expect(submitLead).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alex',
      email: 'alex@example.com',
      source: 'quote_request',
      metadata: expect.objectContaining({
        pipelineId: 'pipe_123',
        service: 'Strategy',
        budget: '$5k-$10k',
        timeline: '30 days',
      }),
    }));
    expect(managers.overlay?.close).toHaveBeenCalledWith('quote');
    expect(managers.events?.emit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'quote.requested',
    }));
  });
});
