import { useEffect } from 'react';
import { PUBLISHED_RUNTIME_CONFIG } from '../unison/publishedRuntime';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Type = __LucideIcons['Type'] || __LucideFallback;

type PublishedRuntimeConfig = {
  siteId: string | null;
  businessId: string | null;
  projectId: string | null;
  snapshotId: string | null;
  formEndpoint: string | null;
};

const VALID_INTENTS = new Set([
  'contact.submit',
  'quote.request',
  'booking.request',
  'newsletter.subscribe',
  'application.submit',
]);

function setStatus(form: HTMLFormElement, message: string, failed = false) {
  let status = form.querySelector('[data-unison-form-status]') as HTMLElement | null;
  if (!status) {
    status = document.createElement('p');
    status.dataset.unisonFormStatus = 'true';
    status.setAttribute('role', 'status');
    status.style.margin = '0.75rem 0 0';
    status.style.fontSize = '0.9rem';
    form.appendChild(status);
  }
  status.textContent = message;
  status.style.color = failed ? '#b91c1c' : '#15803d';
}

function createIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'form-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

export function usePublishedFormRuntime() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent !== window) return;
    const runtime = PUBLISHED_RUNTIME_CONFIG;

    const onSubmit = async (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.demoForm !== 'true') return;
      event.preventDefault();
      if (!runtime.siteId || !runtime.businessId || !runtime.projectId || !runtime.formEndpoint) {
        setStatus(form, 'This form is not connected yet.', true);
        return;
      }

      const section = form.closest('[data-ut-section-id]') as HTMLElement | null;
      const requestedIntent = form.dataset.utIntent || 'contact.submit';
      const intent = VALID_INTENTS.has(requestedIntent) ? requestedIntent : 'contact.submit';
      const formId = intent;
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => {
        if (typeof value === 'string' && key.length <= 100) data[key] = value.slice(0, 5000);
      });
      const submitter = form.querySelector('button[type="submit"], input[type="submit"]') as HTMLButtonElement | HTMLInputElement | null;
      if (submitter) submitter.disabled = true;
      form.dataset.unisonSubmitState = 'submitting';

      try {
        const response = await fetch(runtime.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: runtime.businessId,
            projectId: runtime.projectId,
            siteId: runtime.siteId,
            snapshotId: runtime.snapshotId || undefined,
            formId,
            formName: section?.dataset.utSectionType || intent,
            intent,
            pageId: window.location.pathname || '/',
            componentId: section?.dataset.utSectionId || undefined,
            sourceUrl: window.location.href,
            referrer: document.referrer || undefined,
            utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
            utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
            utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
            consentMetadata: {},
            idempotencyKey: createIdempotencyKey(),
            honeypot: '',
            data,
          }),
        });
        if (!response.ok) throw new Error('Form submission failed');
        form.reset();
        form.dataset.unisonSubmitState = 'submitted';
        setStatus(form, 'Thanks. Your submission has been received.');
      } catch {
        form.dataset.unisonSubmitState = 'error';
        setStatus(form, 'We could not send your submission. Please try again.', true);
      } finally {
        if (submitter) submitter.disabled = false;
      }
    };

    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);
}
