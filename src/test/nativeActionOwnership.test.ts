import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
import { PUBLISHED_ACTION_RUNTIME_MODULE } from '@/sections/publishedActionRuntimeModule';

function runtime(intent: string, result: Record<string, unknown>, valid = true, hasForm = true) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const attributes = new Map<string, string>();
  const status = { textContent: '' };
  const scroll = vi.fn();
  const focus = vi.fn();
  const form = {
    dataset: { intentForm: intent }, elements: { namedItem: () => null }, reportValidity: () => valid,
    closest: () => ({ dataset: { utComponentInstanceId: 'cmp' } }),
    matches: () => intent === 'booking.create', scrollIntoView: scroll, querySelector: () => ({ focus }),
    getAttribute: (key: string) => attributes.get(key), setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
  };
  const fetch = vi.fn(async () => ({ ok: true, json: async () => result }));
  const storageKeys: string[] = [];
  const window = { location: { pathname: '/contact' }, setTimeout: (fn: () => void) => fn(), addEventListener: () => {}, dispatchEvent: () => {},
    sessionStorage: { getItem: (key: string) => { storageKeys.push(key); return null; }, setItem: () => {} }, parent: undefined as unknown };
  window.parent = window;
  const exports: Record<string, () => void> = {};
  const source = ts.transpileModule(PUBLISHED_ACTION_RUNTIME_MODULE.replace(/^import .*;$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, {
    exports, useEffect: (fn: () => void) => fn(), window,
    PUBLISHED_RUNTIME_CONFIG: { siteId: 'host-site-a', businessId: 'business-a', runtimeEndpoint: '/site-runtime', runtimeVersion: '1', controllerEndpoints: { 'intent-exec': '/intent-exec' } },
    GENERATED_SITE_RUNTIME_MANIFEST: { enabledCapabilities: ['contact', 'booking'], controllers: [{ functionName: 'intent-exec', transport: 'supabase-function', intents: [intent] }], components: [{ instanceId: 'cmp', writeIntent: intent, slots: [{ intent, slot: 'submit', status: 'ready' }] }] },
    document: { getElementById: () => status, querySelector: () => hasForm ? form : null, querySelectorAll: () => [], addEventListener: (type: string, fn: (event: unknown) => void) => { handlers[type] = fn; } },
    MutationObserver: class { observe() {} disconnect() {} },
    FormData: class { entries() { return [['customerName', 'Alex'], ['customerEmail', 'alex@example.test'], ['serviceId', 'service'], ['slotId', 'slot']][Symbol.iterator](); } },
    fetch, crypto: { randomUUID: () => 'request-id' }, console, URL, Map, CustomEvent: class {},
  });
  exports.usePublishedActionRuntime?.();
  const click = () => handlers.click?.({ target: { closest: () => ({ dataset: { utIntent: intent }, closest: () => null, setAttribute: () => {}, getAttribute: () => null }) }, preventDefault: vi.fn() });
  const submit = () => handlers.submit?.({ target: form, preventDefault: vi.fn() });
  return { fetch, status, scroll, focus, click, submit, storageKeys };
}

describe('native action ownership', () => {
  it.each(['contact.submit', 'lead.capture', 'quote.request', 'newsletter.subscribe'])('%s CTA focuses the native form without an empty backend write', intent => {
    const page = runtime(intent, { ok: true });
    page.click();
    expect(page.scroll).toHaveBeenCalledOnce();
    expect(page.focus).toHaveBeenCalledOnce();
    expect(page.fetch).not.toHaveBeenCalled();
  });
  it('missing native form cannot dispatch a contact submission', () => {
    const page = runtime('contact.submit', { ok: true }, true, false);
    page.click();
    expect(page.fetch).not.toHaveBeenCalled();
  });
  it('booking duplicate submits share a single canonical request scoped to this site', async () => {
    const page = runtime('booking.create', { success: true });
    page.submit(); page.submit();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(page.fetch).toHaveBeenCalledOnce();
    const body = JSON.parse((page.fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toMatchObject({ siteId: 'host-site-a', action: { intent: 'booking.create', componentId: 'cmp', payload: { serviceId: 'service', slotId: 'slot' } } });
    expect(page.storageKeys).toEqual(['unison-runtime-session:host-site-a']);
  });
  it('invalid booking fields cannot reach the backend', () => {
    const page = runtime('booking.create', { success: true }, false);
    page.submit();
    expect(page.fetch).not.toHaveBeenCalled();
  });
  it('booking response without explicit acknowledgment cannot claim confirmation', async () => {
    const page = runtime('booking.create', {});
    page.submit();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(page.status.textContent).toBe('The booking could not be completed.');
  });
});