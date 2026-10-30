import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { PUBLISHED_ACTION_RUNTIME_MODULE } from '@/sections/publishedActionRuntimeModule';

async function submitContact(result: Record<string, unknown>, valid = true) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const attributes = new Map<string, string>();
  const status = { textContent: '' };
  const form = { dataset: { intentForm: 'contact.submit' }, reportValidity: () => valid,
    closest: () => ({ dataset: { utComponentInstanceId: 'cmp-contact' } }),
    getAttribute: (key: string) => attributes.get(key), setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key), querySelector: () => status,
  };
  const fetch = vi.fn(async (_endpoint: string, _request: { body: string }) => ({ ok: true, json: async () => result }));
  const source = ts.transpileModule(PUBLISHED_ACTION_RUNTIME_MODULE.replace(/^import .*;$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, () => void> = {};
  const window = { location: { pathname: '/contact' }, addEventListener: () => {}, sessionStorage: { getItem: () => null, setItem: () => {} }, parent: undefined as unknown };
  window.parent = window;
  runInNewContext(source, { exports, useEffect: (callback: () => void) => callback(),
    PUBLISHED_RUNTIME_CONFIG: { siteId: 'site', businessId: 'business', controllerEndpoints: { 'intent-exec': '/intent-exec' } },
    GENERATED_SITE_RUNTIME_MANIFEST: { enabledCapabilities: ['contact'], controllers: [{ functionName: 'intent-exec', transport: 'supabase-function', intents: ['contact.submit'] }], components: [{ instanceId: 'cmp-contact', writeIntent: 'contact.submit', slots: [{ intent: 'contact.submit', status: 'ready' }] }] },
    document: { getElementById: () => status, querySelectorAll: () => [], addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; }, documentElement: {}, },
    window,
    localStorage: { getItem: () => null, setItem: () => {} }, MutationObserver: class { observe() {} disconnect() {} },
    FormData: class { entries() { return [['name', 'Alex'], ['email', 'alex@example.test'], ['message', 'Hello'], ['field-budget', '500']][Symbol.iterator](); } },
    fetch, crypto: { randomUUID: () => 'request-id' }, console, URL, Map, CustomEvent: class {},
  });
  exports.usePublishedActionRuntime?.();
  const event = { target: form, preventDefault: vi.fn() };
  handlers.submit?.(event);
  handlers.submit?.(event);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { fetch, status };
}

describe('native contact submission', () => {
  it('submits visitor fields exactly once through the canonical controller', async () => {
    const { fetch } = await submitContact({ success: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body ?? '{}');
    expect(body).toMatchObject({ intentId: 'contact.submit', businessId: 'business', params: { name: 'Alex', email: 'alex@example.test', message: 'Hello', 'field-budget': '500', componentId: 'cmp-contact' } });
  });
  it('does not report success when the backend refuses the submission', async () => {
    const { status } = await submitContact({ success: false, error: 'Not saved' });
    expect(status.textContent).toBe('Not saved');
  });
  it('does not submit invalid native fields', async () => {
    const { fetch } = await submitContact({ success: true }, false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not claim success for a response without acknowledgment', async () => {
    const { status } = await submitContact({});
    expect(status.textContent).toBe('The action could not be completed.');
  });
});