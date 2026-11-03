import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import * as __JsxRuntime from 'react/jsx-runtime';
import * as __JsxDevRuntime from 'react/jsx-dev-runtime';
import * as AppModule from './App';
import './index.css';
import { HashRouter as __PreviewHashRouter, useInRouterContext as __useInRouterContext } from 'react-router-dom';
const __RouterGuard = ({ children }: { children: React.ReactNode }) => {
  let inRouter = false;
  try { inRouter = __useInRouterContext(); } catch { inRouter = false; }
  return inRouter ? <>{children}</> : <__PreviewHashRouter>{children}</__PreviewHashRouter>;
};

// React runtime patch disabled — per-file repair passes are authoritative.


// ── Robust App resolution: handle default + named exports gracefully ──
const App = (() => {
  if (AppModule.default && (typeof AppModule.default === 'function' || (typeof AppModule.default === 'object' && (AppModule.default as any).$$typeof))) {
    return AppModule.default;
  }
  for (const [key, value] of Object.entries(AppModule)) {
    if (key === '__esModule' || key === 'default') continue;
    if (/^[A-Z]/.test(key) && (typeof value === 'function' || (typeof value === 'object' && value !== null && (value as any).$$typeof))) {
      return value;
    }
  }
  return null;
})();

// Sandpack replaces the VFS index.html with its own shell, so scripts placed
// there never run. Bootstrap Tailwind here, before the site mounts, to compile
// the generated utility classes alongside the snapshot-owned token stylesheet.
const __tailwindConfig = {
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: 'var(--font-heading, ui-sans-serif, system-ui, sans-serif)',
        body: 'var(--font-body, ui-sans-serif, system-ui, sans-serif)',
      },
    },
  },
};

const __loadTailwindUtilities = () => new Promise<void>((resolve) => {
  if (document.querySelector('[data-unison-tailwind-runtime]')) {
    resolve();
    return;
  }

  (window as any).tailwind = { config: __tailwindConfig };
  const source = document.createElement('style');
  source.type = 'text/tailwindcss';
  source.dataset.unisonTailwindSource = 'true';
  source.textContent = '@tailwind base; @tailwind components; @tailwind utilities;';
  document.head.appendChild(source);

  const loader = document.createElement('script');
  loader.src = 'https://cdn.tailwindcss.com';
  loader.async = true;
  loader.dataset.unisonTailwindRuntime = 'true';
  const finish = () => window.setTimeout(resolve, 0);
  loader.onload = finish;
  loader.onerror = finish;
  document.head.appendChild(loader);
  window.setTimeout(finish, 5000);
});

function __initUnisonPreviewNavBridge() {
  const bridgeWindow = window as Window & { __unisonPreviewNavBridgeInstalled?: boolean };
  if (bridgeWindow.__unisonPreviewNavBridgeInstalled) return;
  bridgeWindow.__unisonPreviewNavBridgeInstalled = true;

  const normalizePath = (rawPath: string) => rawPath.replace(/^\//, '').replace(/\.html(?:[?#].*)?$/, '').replace(/[?#].*$/, '') || 'index';

  // ── In-preview action helpers ─────────────────────────────────────────────

  /** Render a transient feedback toast directly inside the preview iframe */
  function __showPreviewFeedback(message: string, bgColor: string) {
    const existing = document.getElementById('__ut-preview-feedback');
    if (existing) existing.remove();
    const fb = document.createElement('div');
    fb.id = '__ut-preview-feedback';
    fb.setAttribute('style',
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'background:' + (bgColor || '#18181b') + ';color:#fff;padding:10px 18px;' +
      'border-radius:8px;font-size:13px;font-weight:500;z-index:99999;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.25);pointer-events:none;' +
      'transition:opacity 0.25s ease;white-space:nowrap;'
    );
    fb.textContent = message;
    document.body.appendChild(fb);
    setTimeout(function() { fb.style.opacity = '0'; setTimeout(function() { fb.remove(); }, 250); }, 2200);
  }

  /** Priority-ordered CSS selector lists for each canonical intent's target section */
  function __intentSelectors(intent: string): string[] {
    const MAP: Record<string, string[]> = {
      'booking.create':       ['form[data-ut-intent="booking.create"]','[data-ut-intent="booking.create"]:not(button):not(a)','form[data-ut-intent*="booking"]','#booking','[id*="booking-form"]','[class*="booking-form"]','section[id*="book"]','.booking'],
      'contact.submit':       ['form[data-ut-intent="contact.submit"]','[data-ut-intent="contact.submit"]:not(button):not(a)','form[data-ut-intent*="contact"]','#contact','[id*="contact-form"]','[class*="contact-form"]','section[id*="contact"]','.contact-section'],
      'newsletter.subscribe': ['form[data-ut-intent="newsletter.subscribe"]','[data-ut-intent="newsletter.subscribe"]:not(button):not(a)','form[data-ut-intent*="newsletter"]','#newsletter','[id*="newsletter"]','[class*="newsletter"]','input[type="email"]'],
      'quote.request':        ['form[data-ut-intent="quote.request"]','[data-ut-intent="quote.request"]:not(button):not(a)','form[data-ut-intent*="quote"]','#quote','[id*="quote-form"]','[class*="quote-form"]','section[id*="quote"]'],
      'lead.capture':         ['form[data-ut-intent="lead.capture"]','[data-ut-intent="lead.capture"]:not(button):not(a)','form[data-ut-intent*="lead"]','#lead','#contact','[id*="lead-form"]','input[type="email"]'],
      'auth.login':           ['form[data-ut-intent="auth.login"]','[data-ut-intent="auth.login"]:not(button):not(a)','form[data-ut-intent*="auth"]','#login','#auth','[id*="login-form"]','[class*="auth-form"]'],
      'auth.register':        ['form[data-ut-intent="auth.register"]','[data-ut-intent="auth.register"]:not(button):not(a)','form[data-ut-intent*="register"]','#register','#signup','[id*="register-form"]','[class*="auth-form"]'],
      'pay.checkout':         ['[data-ut-intent="pay.checkout"]:not(button):not(a)','#pricing','[id*="pricing"]','[class*="pricing-section"]','#checkout','[class*="checkout"]'],
      'cart.checkout':        ['[data-ut-intent="cart.checkout"]:not(button):not(a)','#cart','[id*="cart"]','[class*="cart-section"]','#checkout','[class*="checkout"]'],
    };
    return MAP[intent] || [];
  }

  /** Find the best scroll-target element for an intent, skipping the clicked element */
  function __findIntentTarget(intent: string, clicked: Element): Element | null {
    for (const sel of __intentSelectors(intent)) {
      const found = Array.from(document.querySelectorAll(sel)).find(function(t) {
        return t !== clicked && !t.contains(clicked) && !clicked.contains(t);
      });
      if (found) return found;
    }
    return null;
  }

  /**
   * Build a lightweight inventory of what UI sections/forms currently exist on the page.
   * Sent with every INTENT_TRIGGER so the parent can make smarter routing decisions
   * without having to re-parse the VFS source.
   */
  function __buildPageInventory(): Record<string, unknown> {
    // Collect all unique data-ut-intent values present on page (not buttons/anchors — structural elements)
    const sectionIntents = Array.from(
      new Set(
        Array.from(document.querySelectorAll('[data-ut-intent]:not(button):not(a)'))
          .map(function(e) { return e.getAttribute('data-ut-intent'); })
          .filter(Boolean)
      )
    );
    // Collect important landmark IDs
    const LANDMARK_IDS = ['pricing','booking','contact','newsletter','hero','features','services','about','team','gallery','faq','testimonials','portfolio','products','shop','cart','checkout','login','signup','register','auth'];
    const presentIds = LANDMARK_IDS.filter(function(id) { return !!document.getElementById(id); });
    // Detect forms by their intent
    const formIntents = Array.from(
      new Set(
        Array.from(document.querySelectorAll('form[data-ut-intent]'))
          .map(function(e) { return e.getAttribute('data-ut-intent'); })
          .filter(Boolean)
      )
    );
    // Detect nav links (page names discoverable without generating)
    const navHrefs = Array.from(
      new Set(
        Array.from(document.querySelectorAll('nav a[href], header a[href]'))
          .map(function(e) {
            const h = e.getAttribute('href') || '';
            return h.replace(/^#\//, '/').replace(/^\//, '').replace(/\.html$/, '').replace(/[?#].*$/, '').toLowerCase().trim();
          })
          .filter(function(h) { return h && h !== '' && h !== 'index' && !h.startsWith('http'); })
      )
    );
    return { sectionIntents, presentIds, formIntents, navHrefs };
  }

  /**
   * Attempt an in-preview UI action for the given intent.
   * Returns true if an action was taken so the parent can skip its own duplicate feedback.
   */
  function __handleIntentInPreview(intent: string, clicked: Element): boolean {
    // Visual-feedback-only intents
    if (intent === 'cart.add') {
      __showPreviewFeedback('Added to cart ✓', '#16a34a');
      return true;
    }
    if (intent === 'form.submit') {
      __showPreviewFeedback('Submitted ✓', '#2563eb');
      return true;
    }
    // Slot-aware feedback for direct-action intents that may have no scroll
    // target on the current page (select option, reserve, confirm, etc.).
    const FEEDBACK_LABEL: Record<string, { msg: string; color: string }> = {
      'cart.remove':          { msg: 'Removed from cart',             color: '#dc2626' },
      'cart.checkout':        { msg: 'Opening checkout …',       color: '#2563eb' },
      'pay.checkout':         { msg: 'Opening checkout …',       color: '#2563eb' },
      'booking.create':       { msg: 'Booking request sent ✓',   color: '#16a34a' },
      'booking.confirm':      { msg: 'Booking confirmed ✓',      color: '#16a34a' },
      'reservation.create':   { msg: 'Reservation sent ✓',       color: '#16a34a' },
      'order.place':          { msg: 'Order placed ✓',           color: '#16a34a' },
      'product.select':       { msg: 'Option selected',                color: '#2563eb' },
      'plan.select':          { msg: 'Plan selected',                  color: '#2563eb' },
      'option.select':        { msg: 'Option selected',                color: '#2563eb' },
      'contact.submit':       { msg: 'The enquiry form is not on this page', color: '#2563eb' },
      'newsletter.subscribe': { msg: 'The signup form is not on this page', color: '#2563eb' },
      'quote.request':        { msg: 'The quote form is not on this page', color: '#2563eb' },
      'lead.capture':         { msg: 'The enquiry form is not on this page', color: '#2563eb' },
    };
    // Scroll-to-section intents
    const target = __findIntentTarget(intent, clicked);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the first relevant input inside the target section after scroll settles
      const input = (target as HTMLElement).querySelector(
        'input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea'
      ) as HTMLElement | null;
      if (input) setTimeout(function() { input.focus(); }, 480);
      return true;
    }
    // A form hosted on another page (e.g. Contact): open that page and focus it.
    const formPath = clicked.getAttribute('data-ut-form-path');
    if (formPath && formPath.charAt(0) === '/') {
      window.location.hash = formPath;
      setTimeout(function() {
        const form = document.querySelector('form[data-intent-form], form[data-demo-form="true"]') as HTMLElement | null;
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const field = form.querySelector('input, textarea, select') as HTMLElement | null;
          if (field) field.focus({ preventScroll: true });
        }
      }, 450);
      return true;
    }
    // Fallback toast so every slot intent click is visibly responsive.
    const fb = FEEDBACK_LABEL[intent];
    if (fb) {
      __showPreviewFeedback(fb.msg, fb.color);
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  document.addEventListener('click', function (event) {
    const target = event.target as HTMLElement | null;
    const el = target?.closest?.('a[href], [data-ut-intent], [data-ut-path], button[data-ut-intent]') as HTMLElement | null;
    if (!el) return;

    const utIntent = el.getAttribute('data-ut-intent') || '';
    const path = el.getAttribute('data-ut-path') || el.getAttribute('href') || '';

    // ── Action intents: execute in-preview first, then notify parent ──
    if (utIntent && utIntent !== 'nav.goto' && utIntent !== 'nav.goto_page' && utIntent !== 'nav.anchor' && utIntent !== 'nav.external') {
      // Only suppress default anchor navigation. Never stopPropagation —
      // React-bound onClick handlers (booking overlays, cart drawers, plan
      // selectors, etc.) must still run alongside the intent broadcast,
      // otherwise UI controls appear unresponsive on every generated site.
      const tagName = el.tagName ? el.tagName.toLowerCase() : '';
      if (tagName === 'a') {
        event.preventDefault();
      }
      const reqId = 'intent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const intentPayload: Record<string, unknown> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('data-ut-') && attr.name !== 'data-ut-intent') {
          intentPayload[attr.name.replace('data-ut-', '')] = attr.value;
        }
      }
      intentPayload.buttonLabel = el.textContent ? el.textContent.trim().substring(0, 60) : '';
      intentPayload.source = 'preview';
      // Attempt the direct in-preview action; tell the parent whether we handled it
      intentPayload.inPreviewHandled = __handleIntentInPreview(utIntent, el);
      // Send a lightweight DOM inventory so the parent can route intelligently
      intentPayload.pageInventory = __buildPageInventory();
      window.parent.postMessage({
        type: 'INTENT_TRIGGER',
        intent: utIntent,
        payload: intentPayload,
        requestId: reqId,
      }, '*');
      return;
    }

    // ── nav.goto / nav.goto_page: navigate directly via hash router ──
    if (utIntent === 'nav.goto' || utIntent === 'nav.goto_page') {
      event.preventDefault();
      event.stopPropagation();
      const navPath = el.getAttribute('data-ut-path') || path;
      const targetPageId = el.getAttribute('data-ut-target-page-id');
      if (navPath && navPath !== '#') {
        const route = navPath.startsWith('#')
          ? '/' + navPath.replace(/^#\/?/, '')
          : navPath.startsWith('/') ? navPath : '/' + navPath;
        window.location.hash = route;
      } else if (targetPageId) {
        // Fallback: ask parent to resolve page ID to route
        window.parent.postMessage({
          type: 'INTENT_TRIGGER',
          intent: 'nav.goto_page',
          payload: { targetPageId, buttonLabel: el.textContent?.trim()?.substring(0, 40) || '', source: 'preview' },
          requestId: 'nav-' + Date.now(),
        }, '*');
      }
      return;
    }

    // ── Anchor scroll ──
    if (!path || path === '#' || path.startsWith('http') || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('javascript:')) return;

    if (path.startsWith('#') && !path.startsWith('#/')) {
      const section = document.querySelector(path);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        event.preventDefault();
      }
      return;
    }

    // ── Hash route links (e.g. href="#/services") — navigate directly ──
    if (path.startsWith('#/')) {
      event.preventDefault();
      window.location.hash = path.substring(1);
      return;
    }

    const pageName = normalizePath(path);
    if (pageName === 'index') return;

    event.preventDefault();
    event.stopPropagation();

    const targetRoute = '/' + pageName;

    // Check if this page exists in the hash router by trying hash navigation first
    // The router will render a fallback/404 if it doesn't exist
    const targetPageId = el.getAttribute('data-ut-target-page-id');
    if (targetPageId) {
      window.location.hash = targetRoute;
      return;
    }

    // Try direct hash navigation — if the route is in the router it renders immediately
    window.location.hash = targetRoute;

    // Also notify parent so it can generate the page if missing
    window.parent.postMessage({
      type: 'NAV_PAGE_GENERATE',
      pageName,
      navLabel: el.textContent ? el.textContent.trim().substring(0, 40) : pageName,
      requestId: 'click-' + Date.now(),
    }, '*');
  }, true);

  // ── Form submission bridge: intercept forms with data-ut-intent ──
  document.addEventListener('submit', function (event) {
    const form = event.target as HTMLFormElement;
    if (!form || form.tagName !== 'FORM') return;
    // Published action runtime yields in hosted previews; the bridge owns native submission here.
    const formIntent = form.getAttribute('data-intent-form') || form.getAttribute('data-ut-intent');
    if (!formIntent) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => { payload[key] = value.toString(); });
    payload.source = 'preview-form';
    // Parent acknowledgment owns success; dispatch alone is not a saved submission.
    window.parent.postMessage({
      type: 'INTENT_TRIGGER',
      intent: formIntent,
      payload,
      requestId: 'form-' + Date.now(),
    }, '*');
  }, true);

  // ── Message handlers for navigation and intent commands ──
  window.addEventListener('message', function (event) {
    // Commands are only accepted from the builder that hosts this preview.
    if (event.source !== window.parent || window.parent === window) return;
    if (event.data?.type === 'NAV_ROUTE' && event.data.route) {
      window.location.hash = event.data.route;
    }
    // Reveal a saved record's real rendered instance (Playground Assets).
    if (event.data?.type === 'REVEAL_RESOURCE' && typeof event.data.mark === 'string') {
      var mark = event.data.mark;
      var tries = 0;
      var reveal = function () {
        var el = document.querySelector('[data-ut-resource^="' + mark.replace(/"/g, '') + '"]');
        if (!el) { if (++tries < 20) setTimeout(reveal, 150); return; }
        var selectPreviewElement = (window as any).__unisonPreviewSelectElement;
        if (typeof selectPreviewElement === 'function') selectPreviewElement(el);
        var host = el.closest('article, li, section, [data-ut-section]') || el;
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var prev = host.style.outline;
        host.style.outline = '2px solid hsl(var(--primary, 221 83% 53%))';
        host.style.outlineOffset = '4px';
        setTimeout(function () { host.style.outline = prev; }, 1800);
      };
      reveal();
    }
    // Send back a record's real rendered markup + the page's own CSS so the
    // Playground Assets panel can show its actual on-site appearance.
    if (event.data?.type === 'SNAPSHOT_RESOURCE' && typeof event.data.mark === 'string') {
      var snapMark = event.data.mark;
      var snapTries = 0;
      var snap = function () {
        var el = document.querySelector('[data-ut-resource^="' + snapMark.replace(/"/g, '') + '"]');
        // Older sites carry no marks: fall back to the record's visible name.
        if (!el && typeof event.data.name === 'string' && event.data.name.trim().length > 2) {
          var want = event.data.name.trim().toLowerCase();
          var cands = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,dt,figcaption,blockquote,a');
          for (var k = 0; k < cands.length; k++) {
            var t = (cands[k].textContent || '').trim().toLowerCase();
            if (t === want || (t.length < want.length + 40 && t.indexOf(want) !== -1)) { el = cands[k]; break; }
          }
          if (el) {
            var card = el.closest('article, li, [data-ut-section] > * > *');
            if (!card) { card = el; while (card.parentElement && (card.parentElement.textContent || '').length < 600 && card.parentElement.tagName !== 'SECTION') card = card.parentElement; }
            el = card;
          }
        }
        if (!el) {
          if (++snapTries < 20) { setTimeout(snap, 150); return; }
          window.parent.postMessage({ type: 'RESOURCE_SNAPSHOT', mark: snapMark, html: null, css: null }, '*');
          return;
        }
        var host = el.matches('article, li') ? el : (el.closest('article, li, section, [data-ut-section]') || el);
        var css = '';
        try {
          for (var i = 0; i < document.styleSheets.length; i++) {
            var sheet = document.styleSheets[i];
            try {
              var rules = sheet.cssRules;
              for (var j = 0; j < rules.length; j++) css += rules[j].cssText + '\n';
            } catch (e) { /* cross-origin sheet — skip */ }
          }
        } catch (e) { /* ignore */ }
        window.parent.postMessage({ type: 'RESOURCE_SNAPSHOT', mark: snapMark, html: host.outerHTML, css: css }, '*');
      };
      snap();
    }
    // Playground graph cards use isolated runtime iframes. Navigate each clone
    // to its assigned route, then return the exact rendered resource/component
    // with the generated site's own styles.
    if (event.data?.type === 'SNAPSHOT_PLAYGROUND_GRAPH' && typeof event.data.requestId === 'string') {
      var graphRequest = event.data;
      var graphTries = 0;
      var graphSnapshot = function () {
        var node = null;
        var clean = function (value) { return String(value || '').replace(/"/g, ''); };
        if (graphRequest.kind === 'resource' && graphRequest.targetId) {
          node = document.querySelector('[data-ut-resource^="' + clean(graphRequest.targetId) + '"]');
        }
        if (graphRequest.kind === 'component') {
          if (graphRequest.targetId) {
            node = document.querySelector('[data-ut-component-instance-id="' + clean(graphRequest.targetId) + '"], [data-ut-component-id="' + clean(graphRequest.targetId) + '"]');
          }
          if (!node && graphRequest.componentSlug) {
            node = document.querySelector('[data-ut-component-slug="' + clean(graphRequest.componentSlug) + '"], [data-component="' + clean(graphRequest.componentSlug) + '"], [data-component*="' + clean(graphRequest.componentSlug) + '"]');
          }
        }
        // Legacy authored sites may lack runtime marks. Visible labels still
        // provide a deterministic fallback without fabricating a preview.
        if (!node && typeof graphRequest.name === 'string' && graphRequest.name.trim().length > 2) {
          var wanted = graphRequest.name.trim().toLowerCase();
          var labels = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,dt,figcaption,blockquote,a,button');
          for (var n = 0; n < labels.length; n++) {
            var labelText = (labels[n].textContent || '').trim().toLowerCase();
            if (labelText === wanted || (labelText.length < wanted.length + 40 && labelText.indexOf(wanted) !== -1)) { node = labels[n]; break; }
          }
        }
        if (!node) {
          if (++graphTries < 18) { setTimeout(graphSnapshot, 160); return; }
          window.parent.postMessage({ type: 'PLAYGROUND_GRAPH_SNAPSHOT', requestId: graphRequest.requestId, html: null, css: null }, '*');
          return;
        }
        var graphHost = node.matches('article,li,section,form,[data-component]') ? node : (node.closest('article,li,section,form,[data-component],[data-ut-section]') || node);
        var graphCss = '';
        try {
          for (var si = 0; si < document.styleSheets.length; si++) {
            try {
              var graphRules = document.styleSheets[si].cssRules;
              for (var ri = 0; ri < graphRules.length; ri++) graphCss += graphRules[ri].cssText + '\n';
            } catch (e) { /* cross-origin stylesheet */ }
          }
        } catch (e) { /* ignore */ }
        window.parent.postMessage({ type: 'PLAYGROUND_GRAPH_SNAPSHOT', requestId: graphRequest.requestId, html: graphHost.outerHTML, css: graphCss }, '*');
      };
      graphSnapshot();
    }
    // Live Preview asset scan (Playground Assets): read-only discovery of
    // repeated items actually rendered on the page, saved or not.
    if (event.data?.type === 'SCAN_ASSETS') {
      var KINDS = [
        ['articles', /insight|journal|blog|article|essay|news|writing|perspective/i],
        ['testimonials', /testimonial|review|what (our )?(clients|customers)|kind words/i],
        ['faqs', /faq|frequently asked|questions/i],
        ['team', /team|our (people|staff|stylists|barbers|experts)|meet (the|our)/i],
        ['gallery', /gallery|portfolio|our work|work|projects|lookbook|case stud|selected/i],
        ['menu', /menu|dishes|food|entrees|starters|mains|desserts/i],
        ['products', /product|shop|collection|store|featured/i],
        ['services', /service|treatment|what we (do|offer)|pricing|packages/i]
      ];
      var txt = function (n) { return n ? (n.textContent || '').replace(/[ ]+/g, ' ').trim() : ''; };
      var css = '';
      try { for (var a = 0; a < document.styleSheets.length; a++) { try { var rr = document.styleSheets[a].cssRules; for (var b = 0; b < rr.length; b++) css += rr[b].cssText + ' '; } catch (e) {} } } catch (e) {}
      var out = [];
      var sections = document.querySelectorAll('section, [data-ut-section]');
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        var head = sec.querySelector('h1,h2,h3');
        if (sec.closest('nav, header, footer') || (sec.parentElement && sec.parentElement.closest('section, [data-ut-section]'))) continue;
        var sig = (sec.getAttribute('id') || '') + ' ' + (sec.getAttribute('data-ut-section') || '') + ' ' + (sec.getAttribute('data-ut-section-type') || '') + ' ' + (sec.getAttribute('aria-label') || '') + ' ' + txt(head);
        var kind = null;
        for (var ki = 0; ki < KINDS.length; ki++) { if (KINDS[ki][1].test(sig)) { kind = KINDS[ki][0]; break; } }
        // Largest group of same-tag siblings with text = the repeated items.
        var best = [], all = sec.querySelectorAll('*');
        for (var ci = 0; ci < all.length; ci++) {
          var kids = Array.prototype.filter.call(all[ci].children, function (c) { return txt(c).length > 2; });
          if (kids.length < 2) continue;
          var tag = kids[0].tagName;
          var same = kids.filter(function (c) { return c.tagName === tag; });
          if (same.length >= 2 && same.length > best.length && same.length >= kids.length - 1) best = same;
        }
        if (!best.length) continue;
        // No telling heading: infer the kind from what the repeated items hold.
        if (!kind) {
          var sample = best[0];
          var sText = txt(sample);
          if (sample.querySelector('blockquote, q') || /^[“"]/.test(sText)) kind = 'testimonials';
          else if (/[$£€][ ]?[0-9]/.test(sText)) kind = 'products';
          else if (sample.querySelector('details, summary')) kind = 'faqs';
          else if (sample.querySelector('img') && sText.length < 160) kind = 'gallery';
          else if (sample.querySelector('h3, h4') && sText.length > 30) kind = 'services';
          else continue;
        }
        for (var ii = 0; ii < best.length && ii < 24; ii++) {
          var it = best[ii];
          var h = it.querySelector('h2,h3,h4,h5,h6,dt,summary,strong,figcaption');
          var paras = it.querySelectorAll('p, blockquote, dd');
          var body = paras.length ? Array.prototype.map.call(paras, txt).filter(Boolean).join('\n') : '';
          var all2 = txt(it);
          var price = all2.match(/[$£€][ ]?[0-9][0-9.,]*/);
          var img = it.querySelector('img');
          var imageUrl = img ? (img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src')) : null;
          var name = txt(it.querySelector('h1,h2,h3,h4')) || txt(h) || body.slice(0, 60);
          if (!name) continue;
          if (kind === 'testimonials') { var cite = it.querySelector('cite, figcaption, footer, strong'); name = txt(cite) || name; body = txt(it.querySelector('blockquote, p')) || body; }
          var scanFields = {};
          var resourceMark = null;
          var scanNodes = [it].concat(Array.prototype.slice.call(it.querySelectorAll('*')));
          var scanValue = function (node) {
            if (node.tagName === 'IMG') return node.currentSrc || node.getAttribute('src') || node.getAttribute('data-src') || '';
            if (node.tagName === 'INPUT' && node.type === 'checkbox') return String(node.checked);
            if (node.hasAttribute && node.hasAttribute('value')) return node.getAttribute('value');
            return txt(node);
          };
          for (var fi = 0; fi < scanNodes.length; fi++) {
            var fieldNode = scanNodes[fi];
            var markedResource = fieldNode.getAttribute && fieldNode.getAttribute('data-ut-resource');
            if (markedResource) {
              if (!resourceMark) resourceMark = markedResource;
              var markedField = markedResource.match(/^[a-z0-9:_-]+#[^.#\s]+\.([A-Za-z0-9_]+)$/);
              if (markedField) scanFields[markedField[1]] = scanValue(fieldNode);
            }
            var fieldKey = fieldNode.getAttribute && (fieldNode.getAttribute('data-ut-field') || fieldNode.getAttribute('data-field'));
            if (fieldKey) scanFields[fieldKey] = scanValue(fieldNode);
            if (fieldNode.attributes) {
              for (var ai = 0; ai < fieldNode.attributes.length; ai++) {
                var attribute = fieldNode.attributes[ai];
                if (!/^data-(?!ut-resource$|ut-field$)/.test(attribute.name)) continue;
                var dataKey = attribute.name.replace(/^data-(?:ut-)?/, '').replace(/-/g, '_');
                if (dataKey) scanFields[dataKey] = attribute.value;
              }
            }
          }
          if (!Object.prototype.hasOwnProperty.call(scanFields, 'name')) scanFields.name = name;
          if (body && !Object.prototype.hasOwnProperty.call(scanFields, 'description')) scanFields.description = body;
          if (imageUrl && !Object.prototype.hasOwnProperty.call(scanFields, 'image_url')) scanFields.image_url = imageUrl;
          if (price && !Object.prototype.hasOwnProperty.call(scanFields, 'price') && !Object.prototype.hasOwnProperty.call(scanFields, 'price_cents')) scanFields.price = price[0];
          if (kind === 'menu') {
            var badgeNodes = it.querySelectorAll('[data-dietary-tag], [data-ut-dietary-tag], [aria-label*="dietary" i], [class*="badge"], [class*="tag"], [class*="chip"], [class*="pill"]');
            var dietaryTags = [];
            var featuredBadge = false;
            for (var bi = 0; bi < badgeNodes.length; bi++) {
              var badge = badgeNodes[bi];
              var badgeText = txt(badge);
              var dietaryMatches = badgeText.match(/\b(gluten[- ]free|dairy[- ]free|vegan|vegetarian|pescatarian|nut[- ]free|halal|kosher|keto)\b/gi) || [];
              dietaryMatches.forEach(function (tag) { if (!dietaryTags.includes(tag.toLowerCase())) dietaryTags.push(tag.toLowerCase()); });
              if (/\b(featured|house signature|signature|chef.?s special|popular)\b/i.test(badgeText)) featuredBadge = true;
            }
            if (dietaryTags.length && !Object.prototype.hasOwnProperty.call(scanFields, 'dietary_tags')) scanFields.dietary_tags = dietaryTags;
            if (featuredBadge && !Object.prototype.hasOwnProperty.call(scanFields, 'featured')) scanFields.featured = true;
          }
          var meta = null;
          if (kind === 'articles') { var tm = it.querySelector('time'); var by = it.querySelector('[class*="author"], address'); meta = { date: tm ? (tm.getAttribute('datetime') || txt(tm)) : (all2.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* [0-9]{1,2},? [0-9]{4}/) || [null])[0], readTime: (all2.match(/[0-9]+ min read/i) || [null])[0], author: by ? txt(by).slice(0, 80) : null }; }
          out.push({ meta: meta, kind: kind, section: txt(head), name: name.slice(0, 120), description: body.slice(0, 2000), price: price ? price[0] : null, image: imageUrl, fields: scanFields, resourceMark: resourceMark, html: it.outerHTML.slice(0, 20000) });
        }
      }
      window.parent.postMessage({ type: 'ASSET_SCAN', requestId: event.data.requestId, items: out, css: css, route: window.location.hash }, '*');
    }
    // Handle intent-based scroll/focus commands from parent
    if (event.data?.type === 'INTENT_COMMAND') {
      const { command, requestId: cmdReqId } = event.data;
      let handled = false;
      // Derive the canonical intent from the command name
      // e.g. "booking.scroll" → "booking.create", "contact.scroll" → "contact.submit"
      const intentKey: string = (
        command === 'booking.scroll'     ? 'booking.create'       :
        command === 'contact.scroll'     ? 'contact.submit'       :
        command === 'newsletter.scroll'  ? 'newsletter.subscribe' :
        command === 'quote.scroll'       ? 'quote.request'        :
        command === 'lead.scroll'        ? 'lead.capture'         :
        command === 'auth.scroll'        ? 'auth.login'           :
        command === 'checkout.scroll'    ? 'pay.checkout'         :
        command
      );
      const target = __findIntentTarget(intentKey, document.documentElement);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        handled = true;
      }
      window.parent.postMessage({ type: 'INTENT_COMMAND_RESULT', command, requestId: cmdReqId, handled }, '*');
    }
  });
}

__initUnisonPreviewNavBridge();

function __initUnisonPreviewSelectionBridge() {
  const bridgeWindow = window as Window & { __unisonPreviewSelectionBridgeInstalled?: boolean };
  if (bridgeWindow.__unisonPreviewSelectionBridgeInstalled) return;
  bridgeWindow.__unisonPreviewSelectionBridgeInstalled = true;

  let active = false;
  let activationKey = 0;
  let revisionId: string | null = null;
  let activeSiteId: string | null = null;
  let hoverEl: HTMLElement | null = null;
  let selectedEl: HTMLElement | null = null;
  let inlineEditingEl: HTMLElement | null = null;
  let inlineOriginalHtml = '';
  let inlineOriginalText = '';
  let inlineEditSequence = 0;
  let pendingInlineEdit: { editId: number; element: HTMLElement; originalHtml: string } | null = null;
  let inlineOriginalEditable: string | null = null;
  let inlineBlurHandler: (() => void) | null = null;
  let inlineKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  const STYLE_ID = '__ut-select-style';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.__ut-hover { outline: 2px dashed hsl(190 95% 55%) !important; outline-offset: 2px !important; cursor: pointer !important; }',
      '.__ut-selected { outline: 2px solid hsl(190 95% 55%) !important; outline-offset: 2px !important; box-shadow: 0 0 0 4px hsla(190, 95%, 55%, 0.18) !important; }',
      '.__ut-inline-edit { cursor: text !important; outline: 2px solid hsl(190 95% 55%) !important; outline-offset: 3px !important; }',
      'html.__ut-select-mode, html.__ut-select-mode body { cursor: crosshair !important; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function clearHover() { if (hoverEl) { hoverEl.classList.remove('__ut-hover'); hoverEl = null; } }
  function clearSelected() { if (selectedEl) { selectedEl.classList.remove('__ut-selected'); selectedEl = null; } }

  function cssEscape(s: string): string {
    return (window as any).CSS && (window as any).CSS.escape
      ? (window as any).CSS.escape(s)
      : s.replace(/([^\\w-])/g, '\\$1');
  }
  function findAncestorAttr(el: Element, attr: string): string | null {
    let cur: Element | null = el.parentElement;
    let depth = 0;
    while (cur && cur !== document.body && depth < 24) {
      const v = cur.getAttribute(attr);
      if (v) return v;
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }
  function computeSelector(el: Element): string {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    if ((el as HTMLElement).id) return '#' + cssEscape((el as HTMLElement).id);
    const dataKey = el.getAttribute('data-ut-key');
    if (dataKey) return '[data-ut-key="' + cssEscape(dataKey) + '"]';
    const dataBinding = el.getAttribute('data-ut-binding-id');
    if (dataBinding) return '[data-ut-binding-id="' + cssEscape(dataBinding) + '"]';
    // Slot identity — scope by nearest section so duplicate slot names across
    // sections (e.g. two "primary-cta" slots) still resolve uniquely.
    const slotId = el.getAttribute('data-ut-slot');
    if (slotId) {
      const secId =
        findAncestorAttr(el, 'data-ut-section-id') ||
        findAncestorAttr(el, 'data-ut-section');
      if (secId) {
        return '[data-ut-section-id="' + cssEscape(secId) + '"] [data-ut-slot="' + cssEscape(slotId) + '"], '
          + '[data-ut-section="' + cssEscape(secId) + '"] [data-ut-slot="' + cssEscape(slotId) + '"]';
      }
      return '[data-ut-slot="' + cssEscape(slotId) + '"]';
    }
    // Intent identity — canonical action-carrying elements (buttons/links) are
    // rarely duplicated within a section and give the AI a durable target.
    const intent = el.getAttribute('data-ut-intent');
    if (intent) {
      const secId =
        findAncestorAttr(el, 'data-ut-section-id') ||
        findAncestorAttr(el, 'data-ut-section');
      if (secId) {
        return '[data-ut-section-id="' + cssEscape(secId) + '"] [data-ut-intent="' + cssEscape(intent) + '"], '
          + '[data-ut-section="' + cssEscape(secId) + '"] [data-ut-intent="' + cssEscape(intent) + '"]';
      }
      return '[data-ut-intent="' + cssEscape(intent) + '"]';
    }
    const bindingKey = el.getAttribute('data-ut-binding-key') || el.getAttribute('data-element-key');
    if (bindingKey) return '[data-ut-binding-key="' + cssEscape(bindingKey) + '"], [data-element-key="' + cssEscape(bindingKey) + '"]';
    const elementIdAttr = el.getAttribute('data-ut-element');
    if (elementIdAttr) return '[data-ut-element="' + cssEscape(elementIdAttr) + '"]';
    const componentInstanceId = el.getAttribute('data-ut-component-instance-id');
    if (componentInstanceId) return '[data-ut-component-instance-id="' + cssEscape(componentInstanceId) + '"]';
    const componentSlug = el.getAttribute('data-component');
    if (componentSlug) return '[data-component="' + cssEscape(componentSlug) + '"]';
    const parts: string[] = [];
    let node: Element | null = el;
    let depth = 0;
    while (node && node !== document.body && depth < 6) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) { parts.unshift(tag); break; }
      const sameTag = Array.from(parent.children).filter(c => c.tagName === node!.tagName);
      if (sameTag.length === 1) {
        parts.unshift(tag);
      } else {
        const idx = sameTag.indexOf(node) + 1;
        parts.unshift(tag + ':nth-of-type(' + idx + ')');
      }
      node = parent;
      depth++;
    }
    return parts.join(' > ');
  }

  function findSection(el: Element): string | null {
    let cur: Element | null = el;
    while (cur && cur !== document.body) {
      if (cur.tagName === 'SECTION') {
        return cur.getAttribute('id') || cur.getAttribute('data-section') || cur.tagName.toLowerCase();
      }
      const dataSection = cur.getAttribute('data-section') || cur.getAttribute('data-ut-section') || cur.getAttribute('data-ut-section-id');
      if (dataSection) return dataSection;
      cur = cur.parentElement;
    }
    return null;
  }

  // Walk ancestors and collect Unison scope IDs + intent bindings so the
  // floating toolbar's EditScopeResolver can pick element/block/section scope.
  function collectScopeAncestors(el: Element): {
    elementId: string | null;
    slotId: string | null;
    blockId: string | null;
    sectionId: string | null;
    sectionType: string | null;
    surfaceId: string | null;
    componentType: string | null;
    componentInstanceId: string | null;
    sourceHash: string | null;
    astIdentity: string | null;
    sourceRevisionId: string | null;
    artifactId: string | null;
    elementRole: string | null;
    entityKind: string | null;
    sourceLocator: string | null;
    bindingId: string | null;
    bindingKey: string | null;
    sourceTable: string | null;
    rowId: string | null;
    field: string | null;
    targetPath: string | null;
    pageId: string | null;
    siteId: string | null;
    pagePath: string | null;
    intents: string[];
    primaryIntent: string | null;
    clickedTag: string;
  } {
    let elementId: string | null = el.getAttribute('data-ut-element-id') || el.getAttribute('data-ut-element') || null;
    let slotId: string | null = null;
    let blockId: string | null = null;
    let sectionId: string | null = null;
    let sectionType: string | null = null;
    let surfaceId: string | null = null;
    let componentType: string | null = null;
    let componentInstanceId: string | null = null;
    let sourceHash: string | null = null;
    let astIdentity: string | null = null;
    let sourceRevisionId: string | null = null;
    let artifactId: string | null = null;
    let elementRole: string | null = null;
    let entityKind: string | null = null;
    let sourceLocator: string | null = null;
    let bindingId: string | null = null;
    let bindingKey: string | null = null;
    let sourceTable: string | null = null;
    let rowId: string | null = null;
    let resource: string | null = null;
    let field: string | null = null;
    let targetPath: string | null = el.getAttribute('data-ut-path') || el.getAttribute('href') || null;
    let pageId: string | null = null;
    const siteId = activeSiteId;
    let pagePath: string | null = null;
    const intents: string[] = [];
    const primaryIntent: string | null = el.getAttribute('data-ut-intent') || null;
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 24) {
      if (!elementId) elementId = cur.getAttribute('data-ut-element-id') || cur.getAttribute('data-ut-element') || elementId;
      if (!slotId) slotId = cur.getAttribute('data-ut-slot');
      if (!blockId) blockId = cur.getAttribute('data-ut-block');
      if (!sectionId) {
        sectionId = cur.getAttribute('data-ut-section-id')
          || cur.getAttribute('data-ut-section')
          || (cur.tagName === 'SECTION' ? (cur.getAttribute('id') || null) : null);
      }
      if (!sectionType) sectionType = cur.getAttribute('data-ut-section-type');
      if (!surfaceId) surfaceId = cur.getAttribute('data-ut-surface');
      if (!componentType) componentType = cur.getAttribute('data-ut-component-type') || cur.getAttribute('data-component');
      if (!componentInstanceId) componentInstanceId = cur.getAttribute('data-ut-component-id') || cur.getAttribute('data-ut-component-instance-id');
      if (!sourceHash) sourceHash = cur.getAttribute('data-ut-source-hash');
      if (!astIdentity) astIdentity = cur.getAttribute('data-ut-source-ast');
      if (!sourceRevisionId) sourceRevisionId = cur.getAttribute('data-ut-source-revision');
      if (!artifactId) artifactId = cur.getAttribute('data-ut-registry-key');
      if (!elementRole) elementRole = cur.getAttribute('data-ut-role');
      if (!entityKind) entityKind = cur.getAttribute('data-ut-entity');
      if (!sourceLocator) sourceLocator = cur.getAttribute('data-ut-source-locator');
      if (!bindingId) bindingId = cur.getAttribute('data-ut-binding-id');
      if (!bindingKey) bindingKey = cur.getAttribute('data-ut-binding-key') || cur.getAttribute('data-element-key');
      if (!sourceTable) sourceTable = cur.getAttribute('data-ut-source-table');
      if (!rowId) rowId = cur.getAttribute('data-ut-row-id') || cur.getAttribute('data-ut-product-id');
      if (!field) field = cur.getAttribute('data-ut-field');
      if (!resource) resource = cur.getAttribute('data-ut-resource');
      if (!targetPath) targetPath = cur.getAttribute('data-ut-path') || cur.getAttribute('href') || cur.getAttribute('data-ut-target-page-id');
      if (!pageId) pageId = cur.getAttribute('data-ut-page');
      if (!pagePath) pagePath = cur.getAttribute('data-ut-page-path') || cur.getAttribute('data-page-path');
      const intent = cur.getAttribute('data-ut-intent');
      if (intent && !intents.includes(intent)) intents.push(intent);
      cur = cur.parentElement;
      depth++;
    }
    // Generated pages rarely carry data-ut-page-path; the HashRouter route the
    // element was clicked on is the authoritative page identity.
    if (!pagePath) {
      try {
        const hashRoute = (window.location.hash || '#/').replace(/^#/, '').split('?')[0];
        pagePath = hashRoute || '/';
      } catch (_) { pagePath = '/'; }
    }
    // M1 identity: index among repeated siblings (cards in a grid) and a
    // structural locator so the same item is re-found after rerender.
    let repeatIndex: number | null = null;
    let structuralPath = '';
    try {
      let n: Element | null = el; let hops = 0; const parts: string[] = [];
      while (n && n.parentElement && hops < 12) {
        const p = n.parentElement;
        const same = Array.prototype.filter.call(p.children, (c: Element) => c.tagName === n!.tagName && c.className === n!.className) as Element[];
        if (repeatIndex === null && same.length > 1) repeatIndex = same.indexOf(n);
        parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? '[]' : ''));
        if (n.tagName === 'SECTION' || n.hasAttribute('data-ut-section-id')) break;
        n = p; hops++;
      }
      structuralPath = parts.join('>');
    } catch (_) { /* best effort */ }
    return {
      repeatIndex,
      structuralPath,
      sourceLocator,
      sourceHash,
      astIdentity,
      sourceRevisionId,
      elementId,
      slotId,
      blockId,
      sectionId,
      sectionType,
      surfaceId,
      componentType,
      componentInstanceId,
      artifactId,
      elementRole,
      entityKind,
      bindingId,
      bindingKey,
      sourceTable,
      rowId,
      field,
      resource,
      targetPath,
      pageId,
      siteId,
      pagePath,
      intents,
      primaryIntent,
      clickedTag: el.tagName.toLowerCase(),
    };
  }

  function snapshotStyles(el: Element): Record<string, string> {
    const cs = window.getComputedStyle(el);
    return {
      color: cs.color, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle, fontFamily: cs.fontFamily,
      textDecoration: cs.textDecoration, textAlign: cs.textAlign,
      padding: cs.padding, margin: cs.margin, borderRadius: cs.borderRadius,
      width: cs.width, height: cs.height, objectFit: cs.objectFit,
    };
  }

  function extractBackgroundImageUrl(value: string | null): string | null {
    if (!value || value === 'none') return null;
    const match = value.match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] || null;
  }

  // Only the clicked element itself is an image target: an <img>, a bare wrapper
  // around exactly one <img> with no text, or an element whose OWN background is
  // a picture. Sections/cards that merely contain images, or sit inside a pictured
  // parent, are not images — they get "add a picture" instead of a swap.
  function findImageTarget(el: Element): { kind: 'img' | 'background'; selector: string; src?: string } | null {
    if (el.tagName === 'IMG') {
      return { kind: 'img', selector: computeSelector(el), src: el.getAttribute('src') || undefined };
    }
    const imgs = el.querySelectorAll('img');
    const bareWrapper = imgs.length === 1 && !(el.textContent || '').trim() && el.querySelectorAll('*').length <= 3;
    if (bareWrapper) {
      const only = imgs[0];
      return { kind: 'img', selector: computeSelector(only), src: only.getAttribute('src') || undefined };
    }
    const src = extractBackgroundImageUrl(window.getComputedStyle(el).backgroundImage);
    if (src) return { kind: 'background', selector: computeSelector(el), src };
    return null;
  }

  function snapshotAttrs(el: Element): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) out[a.name] = a.value;
    return out;
  }

  function selectPreviewElement(el: Element) {
    if (!el || isUiChrome(el)) return;
    clearHover();
    clearSelected();
    selectedEl = el as HTMLElement;
    selectedEl.classList.add('__ut-selected');
    const selector = computeSelector(el);
    const html = el.outerHTML.length > 4000 ? el.outerHTML.slice(0, 4000) : el.outerHTML;
    const scopeAncestors = collectScopeAncestors(el);
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      activationKey,
      element: {
        revisionId,
        tagName: el.tagName.toLowerCase(),
        textContent: (el.textContent || '').trim().slice(0, 500),
        selector, html,
        styles: snapshotStyles(el),
        attributes: snapshotAttrs(el),
        imageTarget: findImageTarget(el),
        section: findSection(el),
        scopeAncestors,
      },
    }, '*');
  }

  function isInlineTextLeaf(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'label', 'td', 'th', 'strong', 'em', 'small'].includes(tag)
      && el.children.length === 0
      && !!(el.textContent || '').trim()
      && !el.isContentEditable;
  }

  function finishInlineTextEdit(save: boolean) {
    const element = inlineEditingEl;
    if (!element) return;
    const originalHtml = inlineOriginalHtml;
    const originalText = inlineOriginalText;
    const text = (element.innerText || element.textContent || '').replace(/ /g, ' ').trim();
    if (inlineBlurHandler) element.removeEventListener('blur', inlineBlurHandler);
    if (inlineKeyHandler) element.removeEventListener('keydown', inlineKeyHandler);
    element.classList.remove('__ut-inline-edit');
    if (inlineOriginalEditable === null) element.removeAttribute('contenteditable');
    else element.setAttribute('contenteditable', inlineOriginalEditable);
    element.removeAttribute('data-ut-inline-edit');
    inlineEditingEl = null;
    inlineBlurHandler = null;
    inlineKeyHandler = null;
    inlineOriginalEditable = null;
    if (!save) {
      element.innerHTML = originalHtml;
      return;
    }
    if (text === originalText) return;

    const editId = ++inlineEditSequence;
    pendingInlineEdit = { editId, element, originalHtml };
    const scope = collectScopeAncestors(element);
    window.parent.postMessage({
      type: 'INLINE_TEXT_EDIT_COMMIT',
      editId,
      revisionId,
      selector: computeSelector(element),
      text,
      originalText,
      target: {
        pagePath: scope.pagePath,
        sectionId: scope.sectionId,
        sectionType: scope.sectionType,
        slotId: scope.slotId,
        resourceMark: element.getAttribute('data-ut-resource') || findAncestorAttr(element, 'data-ut-resource'),
      },
    }, '*');
  }

  function beginInlineTextEdit(element: HTMLElement, event: MouseEvent) {
    if (inlineEditingEl === element) return;
    if (inlineEditingEl) finishInlineTextEdit(true);
    inlineEditingEl = element;
    inlineOriginalHtml = element.innerHTML;
    inlineOriginalText = (element.innerText || element.textContent || '').replace(/ /g, ' ').trim();
    inlineOriginalEditable = element.getAttribute('contenteditable');
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('data-ut-inline-edit', 'true');
    element.classList.add('__ut-inline-edit');
    element.focus();

    const doc = element.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY) ?? doc.createRange();
    if (!range.startContainer || !element.contains(range.startContainer)) range.selectNodeContents(element);
    range.collapse(range.startContainer !== element);
    const selection = doc.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    inlineBlurHandler = () => finishInlineTextEdit(true);
    inlineKeyHandler = (keyEvent) => {
      if (keyEvent.key === 'Escape') {
        keyEvent.preventDefault();
        finishInlineTextEdit(false);
      } else if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key === 'Enter') {
        keyEvent.preventDefault();
        finishInlineTextEdit(true);
      }
    };
    element.addEventListener('blur', inlineBlurHandler);
    element.addEventListener('keydown', inlineKeyHandler);
  }

  (bridgeWindow as any).__unisonPreviewSelectElement = selectPreviewElement;

  function isUiChrome(el: Element | null): boolean {
    if (!el) return true;
    const id = (el as HTMLElement).id || '';
    if (id.startsWith('__ut-')) return true;
    return false;
  }

  function onMouseOver(e: MouseEvent) {
    if (!active) return;
    const t = e.target as HTMLElement | null;
    if (!t || isUiChrome(t) || t === hoverEl) return;
    clearHover();
    hoverEl = t;
    t.classList.add('__ut-hover');
  }
  function onMouseOut(e: MouseEvent) {
    if (!active) return;
    if (e.target === hoverEl) clearHover();
  }
  function onClickCapture(e: MouseEvent) {
    if (!active) return;
    const t = e.target as HTMLElement | null;
    if (!t || isUiChrome(t)) return;
    if (inlineEditingEl && (inlineEditingEl === t || inlineEditingEl.contains(t))) {
      e.stopPropagation();
      if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (typeof (e as any).stopImmediatePropagation === 'function') (e as any).stopImmediatePropagation();
    selectPreviewElement(t);
    if (isInlineTextLeaf(t)) beginInlineTextEdit(t, e);
  }

  function activate() {
    if (active) return;
    active = true;
    ensureStyles();
    document.documentElement.classList.add('__ut-select-mode');
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClickCapture, true);
  }
  function deactivate() {
    if (!active) return;
    if (inlineEditingEl) finishInlineTextEdit(true);
    active = false;
    clearHover();
    clearSelected();
    document.documentElement.classList.remove('__ut-select-mode');
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClickCapture, true);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent || window.parent === window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'EDIT_MODE_TOGGLE') {
      activationKey = typeof data.activationKey === 'number' ? data.activationKey : activationKey + 1;
      revisionId = typeof data.revisionId === 'string' ? data.revisionId : null;
      activeSiteId = typeof data.siteId === 'string' ? data.siteId : null;
      if (data.enabled) activate(); else deactivate();
      window.parent.postMessage({ type: 'EDIT_MODE_READY', activationKey, enabled: !!data.enabled }, '*');
    }
    if (data.type === 'EDIT_MODE_CLEAR_SELECTION') {
      clearSelected();
    }
    if (data.type === 'INLINE_TEXT_EDIT_RESULT' && pendingInlineEdit?.editId === data.editId) {
      if (!data.ok && pendingInlineEdit.element.isConnected) {
        pendingInlineEdit.element.innerHTML = pendingInlineEdit.originalHtml;
      }
      pendingInlineEdit = null;
    }
    // M1c: after a Sandpack rebuild the iframe document is recreated and the
    // previous selection is lost. The parent replays the last selection
    // identity; we resolve the same object and re-apply the highlight.
    if (data.type === 'UT_REACQUIRE_SELECTION' && data.selection) {
      const sel = data.selection;
      let resolved: Element | null = null;
      try {
        // 1) Resource mark is the strongest identity for saved-record values.
        if (sel.resource) {
          const marked = Array.prototype.slice.call(
            document.querySelectorAll('[data-ut-resource="' + String(sel.resource).replace(/"/g, '') + '"]')
          ) as Element[];
          if (marked.length === 1) resolved = marked[0];
          else if (marked.length > 1 && typeof sel.repeatIndex === 'number') resolved = marked[sel.repeatIndex] || null;
        }
        // 2) Stable selector, disambiguated by repeat index when duplicated.
        if (!resolved && sel.selector) {
          const matches = Array.prototype.slice.call(document.querySelectorAll(String(sel.selector))) as Element[];
          if (matches.length === 1) resolved = matches[0];
          else if (matches.length > 1 && typeof sel.repeatIndex === 'number') resolved = matches[sel.repeatIndex] || null;
        }
        // 3) Structural path within the same section (tag chain + repeat index).
        if (!resolved && sel.structuralPath) {
          const parts = String(sel.structuralPath).split('>').filter(Boolean);
          let scope: Element | null = null;
          if (sel.sectionId) {
            scope = document.querySelector('[data-ut-section-id="' + String(sel.sectionId).replace(/"/g, '') + '"]')
              || document.querySelector('[data-ut-section="' + String(sel.sectionId).replace(/"/g, '') + '"]');
          }
          let cur: Element | null = scope || document.body;
          let ok = true;
          for (let i = 0; i < parts.length; i++) {
            if (!cur) { ok = false; break; }
            const part = parts[i];
            const repeated = part.endsWith('[]');
            const tag = repeated ? part.slice(0, -2) : part;
            const kids = Array.prototype.filter.call(cur.children, (c: Element) => c.tagName.toLowerCase() === tag) as Element[];
            if (!kids.length) { ok = false; break; }
            cur = (repeated && typeof sel.repeatIndex === 'number' && i === parts.length - 1)
              ? (kids[sel.repeatIndex] || null)
              : kids[0];
          }
          if (ok && cur && cur !== document.body) resolved = cur;
        }
      } catch (_) { resolved = null; }
      if (resolved) {
        clearSelected();
        selectedEl = resolved as HTMLElement;
        (resolved as HTMLElement).classList.add('__ut-selected');
      }
      window.parent.postMessage({ type: 'UT_REACQUIRE_RESULT', ok: !!resolved }, '*');
    }
    // Read-only verification probe: answers what is actually painted.
    if (data.type === 'UT_PROBE' && Array.isArray(data.checks)) {
      const bodyText = (document.body && document.body.innerText) || '';
      const results = data.checks.map(function (c) {
        try {
          if (c.kind === 'text') return { kind: c.kind, value: c.value, ok: bodyText.toLowerCase().indexOf(String(c.value).toLowerCase()) >= 0 };
          if (c.kind === 'selector') { const n = document.querySelectorAll(String(c.value)).length; return { kind: c.kind, value: c.value, ok: n > 0, count: n }; }
          if (c.kind === 'intent') { const n = document.querySelectorAll('[data-ut-intent="' + String(c.value).replace(/"/g, '') + '"]').length; return { kind: c.kind, value: c.value, ok: n > 0, count: n }; }
        } catch (e) { return { kind: c.kind, value: c.value, ok: false, error: String(e) }; }
        return { kind: c.kind, value: c.value, ok: false, error: 'unknown check' };
      });
      window.parent.postMessage({ type: 'UT_PROBE_RESULT', probeId: data.probeId, route: location.hash || location.pathname, results }, '*');
    }
  });

  window.parent.postMessage({ type: 'EDIT_MODE_BRIDGE_READY' }, '*');
}

__initUnisonPreviewSelectionBridge();

// Error boundary as secondary safety net
class PreviewErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('[Preview] Render crash:', error.message, info?.componentStack?.slice(0, 500));
    window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: error.message }, '*');
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: 32, background: '#0a0a0a', color: '#e5e5e5' }
      },
        React.createElement('div', { style: { maxWidth: 480, textAlign: 'center' } },
          React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '⚠️'),
          React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, marginBottom: 8 } }, 'Preview render error'),
          React.createElement('p', { style: { color: '#a3a3a3', fontSize: 14, marginBottom: 16, lineHeight: 1.6 } }, this.state.error?.message || 'A component failed to render. This usually means an import resolved to undefined.'),
          React.createElement('details', { style: { textAlign: 'left', fontSize: 12, color: '#737373', marginBottom: 16 } },
            React.createElement('summary', { style: { cursor: 'pointer', marginBottom: 8 } }, 'Technical details'),
            React.createElement('pre', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, String(this.state.error?.stack || '').slice(0, 600))
          ),
          React.createElement('button', {
            onClick: () => { this.setState({ hasError: false, error: null }); },
            style: { padding: '8px 20px', borderRadius: 6, border: '1px solid #333', background: '#1a1a1a', color: '#e5e5e5', cursor: 'pointer', fontSize: 14 }
          }, 'Retry')
        )
      );
    }
    return this.props.children;
  }
}

// Sandpack's "running" status confirms its bundler connected, before React
// necessarily mounts. Only a successful app commit may unlock launch review.
function __PreviewRenderReady({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_READY' }, '*');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return children;
}

const __mountPreview = () => {
if (App) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PreviewErrorBoundary>
        <__PreviewRenderReady>
        <__RouterGuard>
          <App />
        </__RouterGuard>
        </__PreviewRenderReady>
      </PreviewErrorBoundary>
    </React.StrictMode>
  );
} else {
  window.parent.postMessage({ type: 'UNISON_PREVIEW_RENDER_ERROR', error: 'App.tsx does not export a renderable component.' }, '*');
  // App module has no valid export — render diagnostic
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>No renderable component found</h2>
        <p style={{ color: '#888', fontSize: 14 }}>App.tsx does not export a valid React component. Check that it uses "export default" or a named PascalCase export.</p>
      </div>
    </div>
  );
}
};

void __loadTailwindUtilities().finally(__mountPreview);
