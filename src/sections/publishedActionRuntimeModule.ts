/**
 * publishedActionRuntimeModule — VFS-injected client-side intent adapter.
 *
 * Deterministic navigation remains native. CTA intents that are represented by
 * a generated public form focus that form; privileged booking and commerce
 * actions remain blocked until their approved runtime adapters are installed.
 */

export const PUBLISHED_ACTION_RUNTIME_PATH = '/src/components/publishedActionRuntime.ts';

export const PUBLISHED_ACTION_RUNTIME_MODULE = `import { useEffect } from 'react';
import { PUBLISHED_RUNTIME_CONFIG } from '@/unison/publishedRuntime';
import { GENERATED_SITE_RUNTIME_MANIFEST } from '@/unison/generatedSiteRuntimeManifest';

const FORM_INTENT_TARGETS: Record<string, string[]> = {
  'contact.submit': ['contact.submit'],
  'lead.capture': ['contact.submit'],
  'quote.request': ['quote.request', 'contact.submit'],
  'newsletter.subscribe': ['newsletter.subscribe'],
};

type RuntimeController = {
  handler: 'client' | 'site-runtime' | 'intent-exec' | 'workflow-trigger' | 'stripe-checkout' | 'auth-overlay' | 'webhook';
  transport: 'client' | 'supabase-function' | 'external';
  functionName: string | null;
  intents: readonly string[];
};

const CONTROLLERS = GENERATED_SITE_RUNTIME_MANIFEST.controllers as readonly RuntimeController[];
const COMPONENTS = GENERATED_SITE_RUNTIME_MANIFEST.components;

function controllerForIntent(intent: string): RuntimeController | undefined {
  return CONTROLLERS.find((controller) => controller.intents.includes(intent));
}

async function submitAuth(form: HTMLFormElement, intent: string) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  const endpoint = (runtime.controllerEndpoints as Record<string, string>)['site-auth'];
  if (!runtime.siteId || !endpoint || !GENERATED_SITE_RUNTIME_MANIFEST.enabledCapabilities.includes('auth')) {
    throw new Error('Authentication is not connected for this site.');
  }
  const fields = new FormData(form);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: runtime.siteId,
      action: intent === 'auth.register' ? 'register' : 'login',
      email: fields.get('email'), password: fields.get('password'), name: fields.get('name'),
    }),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true || !result.session) {
    throw new Error(result.error || 'Authentication could not be completed.');
  }
  // A site session never replaces the platform's auth session.
  window.sessionStorage.setItem('unison-site-session:' + runtime.siteId, JSON.stringify(result.session));
  form.reset();
  window.dispatchEvent(new CustomEvent('unison:site-auth', { detail: { siteId: runtime.siteId, user: result.user } }));
  showActionStatus(form, intent === 'auth.register' ? 'Account created.' : 'Signed in.');
}

function createSessionId(): string {
  const storageKey = 'unison-runtime-session';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'session-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  window.sessionStorage.setItem(storageKey, sessionId);
  return sessionId;
}

function elementParams(element: HTMLElement): Record<string, unknown> {
  const params: Record<string, unknown> = { ...element.dataset };
  const encoded = element.dataset.utParams;
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(params, parsed);
    } catch {
      // Invalid optional params are ignored; the backend still validates required fields.
    }
  }
  return params;
}

function createIdempotencyKey(form: HTMLFormElement): string {
  const existing = form.dataset.utIdempotencyKey;
  if (existing) return existing;
  const key = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'booking-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  form.dataset.utIdempotencyKey = key;
  return key;
}

function bookingComponent(form: HTMLFormElement) {
  const host = form.closest('[data-ut-component-instance-id], [data-ut-component-slug]') as HTMLElement | null;
  const instanceId = host?.dataset.utComponentInstanceId;
  const slug = host?.dataset.utComponentSlug;
  return COMPONENTS.find((component) =>
    component.writeIntent === 'booking.create' &&
    (component.instanceId === instanceId || (!instanceId && component.componentSlug === slug)),
  );
}

function bookingRequestBody(form: HTMLFormElement) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  const component = bookingComponent(form);
  const slot = component?.slots.find((candidate) =>
    candidate.intent === 'booking.create' && candidate.status === 'ready',
  );
  if (!component || !slot) throw new Error('This booking form is not configured for the site.');
  const payload = Object.fromEntries(new FormData(form).entries());
  return {
    operation: 'action',
    runtimeVersion: runtime.runtimeVersion,
    siteId: runtime.siteId,
    action: {
      intent: 'booking.create',
      componentId: component.instanceId,
      slot: slot.slot,
      idempotencyKey: createIdempotencyKey(form),
      sessionId: createSessionId(),
      payload,
    },
  };
}

function requestBody(controller: RuntimeController, intent: string, element: HTMLElement) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  const params = elementParams(element);
  const sessionId = createSessionId();
  if (controller.functionName === 'create-order-checkout') {
    return {
      ...params,
      businessId: runtime.businessId,
      sessionId,
      successUrl: window.location.origin + '/thank-you',
      cancelUrl: window.location.href,
    };
  }
  return {
    siteId: runtime.siteId,
    businessId: runtime.businessId,
    intentId: intent,
    pageId: window.location.pathname || '/',
    params,
    context: { sessionId },
  };
}

async function dispatchBackendIntent(
  controller: RuntimeController,
  intent: string,
  element: HTMLElement,
) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  if (!runtime.siteId || !runtime.businessId || !controller.functionName) {
    throw new Error('This action is not connected to a published site.');
  }
  const endpoint = runtime.controllerEndpoints[controller.functionName];
  if (!endpoint) throw new Error('The backend controller for this action is unavailable.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody(controller, intent, element)),
  });
  const result = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || result.ok === false || result.success === false) {
    throw new Error(result.error?.message || result.error || 'The action could not be completed.');
  }
  const redirectUrl = result.url || result.checkoutUrl || result.redirectUrl;
  if (typeof redirectUrl === 'string' && redirectUrl) window.location.assign(redirectUrl);
  const action = Array.isArray(result.clientActions)
    ? result.clientActions.find((candidate: any) => candidate?.type === 'TOAST')
    : null;
  showActionStatus(element, action?.message || 'Action completed successfully.');
}

async function submitBooking(form: HTMLFormElement) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  if (!runtime.siteId || !runtime.runtimeEndpoint) {
    throw new Error('This booking form is not connected to a published site.');
  }
  const response = await fetch(runtime.runtimeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingRequestBody(form)),
  });
  const result = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || result.success === false) {
    throw new Error(result.error?.message || result.error || 'The booking could not be completed.');
  }
  form.dataset.utIdempotencyKey = '';
  const serviceName = result.state?.booking?.serviceName || result.booking?.serviceName;
  showActionStatus(form, serviceName ? serviceName + ' is booked.' : 'Your booking is confirmed.');
  window.dispatchEvent(new CustomEvent('unison:booking.updated', { detail: result.state || result }));
}

function replaceOptions(select: HTMLSelectElement, options: Array<{ value: string; label: string }>, emptyLabel: string) {
  select.replaceChildren(new Option(emptyLabel, ''));
  for (const option of options) select.add(new Option(option.label, option.value));
  select.disabled = options.length === 0;
}

async function hydrateBookingForm(form: HTMLFormElement) {
  const runtime = PUBLISHED_RUNTIME_CONFIG;
  if (!runtime.siteId || !runtime.runtimeEndpoint || !bookingComponent(form)) return;
  const response = await fetch(runtime.runtimeEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation: 'read',
      runtimeVersion: runtime.runtimeVersion,
      siteId: runtime.siteId,
      read: { type: 'booking', sessionId: createSessionId() },
    }),
  });
  const result = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || result.success === false) throw new Error(result.error || 'Booking availability is unavailable.');
  const services = Array.isArray(result.state?.services) ? result.state.services : [];
  const slots = Array.isArray(result.state?.slots) ? result.state.slots : [];
  const serviceSelect = form.elements.namedItem('serviceId') as HTMLSelectElement | null;
  const slotSelect = form.elements.namedItem('slotId') as HTMLSelectElement | null;
  if (!serviceSelect || !slotSelect) return;
  replaceOptions(serviceSelect, services.map((service: any) => ({
    value: String(service.id),
    label: String(service.name),
  })), 'Select a service');
  const renderSlots = () => {
    const selectedService = serviceSelect.value;
    replaceOptions(slotSelect, slots
      .filter((slot: any) => !slot.service_id || slot.service_id === selectedService)
      .map((slot: any) => ({
        value: String(slot.id),
        label: new Date(slot.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      })), 'Select a time');
  };
  serviceSelect.addEventListener('change', renderSlots);
  renderSlots();
  const latest = Array.isArray(result.state?.bookings) ? result.state.bookings[0] : null;
  if (latest) showActionStatus(form, String(latest.service_name) + ' is ' + String(latest.status) + '.');
}

function focusForm(intent: string): boolean {
  const candidates = FORM_INTENT_TARGETS[intent];
  if (!candidates) return false;
  for (const candidate of candidates) {
    const form = document.querySelector(
      'form[data-demo-form="true"][data-ut-intent="' + candidate + '"]',
    ) as HTMLFormElement | null;
    if (!form) continue;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      const firstField = form.querySelector('input, textarea, select') as HTMLElement | null;
      firstField?.focus({ preventScroll: true });
    }, 250);
    return true;
  }
  return false;
}

function showActionStatus(element: HTMLElement, message: string) {
  const statusId = 'unison-action-status';
  let status = document.getElementById(statusId);
  if (!status) {
    status = document.createElement('p');
    status.id = statusId;
    status.setAttribute('role', 'status');
    status.style.position = 'fixed';
    status.style.left = '1rem';
    status.style.bottom = '1rem';
    status.style.zIndex = '9999';
    status.style.maxWidth = 'min(26rem, calc(100vw - 2rem))';
    status.style.margin = '0';
    status.style.padding = '0.75rem 1rem';
    status.style.borderRadius = '0.5rem';
    status.style.background = '#111827';
    status.style.color = '#ffffff';
    status.style.fontFamily = 'system-ui, sans-serif';
    document.body.appendChild(status);
  }
  status.textContent = message;
  element.setAttribute('aria-describedby', statusId);
}

export function usePublishedActionRuntime() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) return;

    for (const form of document.querySelectorAll('form[data-intent-form="booking.create"]')) {
      void hydrateBookingForm(form as HTMLFormElement).catch((error) => showActionStatus(
        form as HTMLElement,
        error instanceof Error ? error.message : 'Booking availability is unavailable.',
      ));
    }

    const onClick = (event: MouseEvent) => {
      const origin = event.target as Element | null;
      const element = origin?.closest('[data-ut-intent]') as HTMLElement | null;
      if (!element) return;
      const intent = element.dataset.utIntent || '';
      if (!intent || element.closest('form[data-demo-form="true"]')) return;
      // Form submit controls belong to submit, never a duplicate click dispatch.
      if (element.closest('form[data-intent-form^="auth."]')) return;

      if (intent === 'auth.login' || intent === 'auth.register') {
        event.preventDefault();
        const form = document.querySelector('form[data-intent-form="' + intent + '"]') as HTMLFormElement | null;
        if (form) form.querySelector<HTMLInputElement>('input')?.focus();
        else showActionStatus(element, 'The authentication form is not available on this page.');
        return;
      }

      if (focusForm(intent)) {
        event.preventDefault();
        return;
      }
      const controller = controllerForIntent(intent);
      if (!controller || controller.transport !== 'supabase-function') return;
      event.preventDefault();
      element.setAttribute('aria-busy', 'true');
      void dispatchBackendIntent(controller, intent, element)
        .catch((error) => showActionStatus(
          element,
          error instanceof Error ? error.message : 'The action could not be completed.',
        ))
        .finally(() => element.removeAttribute('aria-busy'));
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      const intent = form?.dataset.intentForm;
      if (form && (intent === 'auth.login' || intent === 'auth.register')) {
        event.preventDefault();
        if (form.getAttribute('aria-busy') === 'true' || !form.reportValidity()) return;
        form.setAttribute('aria-busy', 'true');
        void submitAuth(form, intent)
          .catch((error) => showActionStatus(form, error instanceof Error ? error.message : 'Authentication could not be completed.'))
          .finally(() => form.removeAttribute('aria-busy'));
        return;
      }
      if (!form?.matches('form[data-intent-form="booking.create"]')) return;
      event.preventDefault();
      form.setAttribute('aria-busy', 'true');
      void submitBooking(form)
        .catch((error) => showActionStatus(
          form,
          error instanceof Error ? error.message : 'The booking could not be completed.',
        ))
        .finally(() => form.removeAttribute('aria-busy'));
    };

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmit);
    };
  }, []);
}
`;