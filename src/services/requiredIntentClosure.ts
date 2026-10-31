import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';

export interface RequiredIntentClosureResult {
  files: Record<string, string>;
  injected: string[];
  missing: string[];
}

const NON_DOM_INTENTS = new Set(['nav.goto']);

function hasIntent(source: string, intent: string): boolean {
  const escapedIntent = intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = `(?:["']${escapedIntent}["']|\\{\\s*["']${escapedIntent}["']\\s*\\})`;
  return new RegExp(`(?:data-ut-intent|data-intent|data-intent-form|data-intent-trigger)\\s*=\\s*${value}`).test(source)
    // Certified design props: props={{ submitIntent: "x" }} or submitIntent="x".
    || new RegExp(`["']?submitIntent["']?\\s*[:=]\\s*${value}`).test(source);
}

/** Submission intents a single lead form on the site already serves. */
const LEAD_FORM_INTENTS = new Set(['contact.submit', 'lead.capture', 'quote.request']);

/** A rendered lead form: native form, registered host or certified Contact design. */
function hasLeadForm(source: string): boolean {
  return [...LEAD_FORM_INTENTS].some((intent) => hasIntent(source, intent) && /<form\b|data-ut-component-slug|submitIntent/.test(source))
    || /data-ut-component-slug\s*=\s*["'](?:contact-form|request-quote)["']/.test(source)
    || /from\s+['"]@\/unison\/design-sources\/Contact['"]/.test(source);
}

/** Inside <main>, before the shared footer — never after it. */
function bodyInsertionIndex(source: string): number {
  const mainClose = source.lastIndexOf('</main>');
  if (mainClose >= 0) return mainClose;
  const footer = /<(?:SiteFooter|footer)\b/.exec(source);
  if (footer) return footer.index;
  const layoutClose = source.lastIndexOf('</SiteLayout>');
  if (layoutClose >= 0) return layoutClose;
  return Math.max(source.lastIndexOf('</section>'), source.lastIndexOf('</div>'));
}

function labelForIntent(intent: string): string {
  const labels: Record<string, string> = {
    'cart.add': 'Add to Cart',
    'cart.view': 'View Cart',
    'cart.checkout': 'Checkout',
    'booking.create': 'Book Now',
    'contact.submit': 'Contact Us',
    'lead.capture': 'Get Started',
    'donation.start': 'Donate Now',
    'quote.request': 'Request a Quote',
    'newsletter.subscribe': 'Subscribe',
  };
  return labels[intent] || intent.split('.').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function preferredFilePaths(intent: string): RegExp[] {
  if (/^cart\./.test(intent)) return [/\/Cart\.(?:tsx|jsx)$/i, /\/Checkout\.(?:tsx|jsx)$/i, /\/Shop\.(?:tsx|jsx)$/i, /\/Home\.(?:tsx|jsx)$/i];
  if (/booking|reservation/.test(intent)) return [/\/Booking\.(?:tsx|jsx)$/i, /\/Home\.(?:tsx|jsx)$/i];
  if (/newsletter/.test(intent)) return [/\/Contact\.(?:tsx|jsx)$/i, /\/Home\.(?:tsx|jsx)$/i];
  if (/contact|lead|quote|location/.test(intent)) return [/\/Contact\.(?:tsx|jsx)$/i, /\/Home\.(?:tsx|jsx)$/i];
  if (/donation/.test(intent)) return [/\/Donate\.(?:tsx|jsx)$/i, /\/Home\.(?:tsx|jsx)$/i];
  return [/\/Home\.(?:tsx|jsx)$/i];
}

/**
 * Intents whose contract is a submission, not a click. Closing them with a bare
 * button leaves the runtime with no payload, so the closure materializes a real
 * form (the binding resolver then wires it to the capability).
 */
const FORM_INTENTS: Record<string, { title: string; fields: Array<{ name: string; type: string; label: string }> }> = {
  'newsletter.subscribe': {
    title: 'Subscribe to our newsletter',
    fields: [{ name: 'email', type: 'email', label: 'Email address' }],
  },
  'contact.submit': {
    title: 'Send us a message',
    fields: [
      { name: 'name', type: 'text', label: 'Name' },
      { name: 'email', type: 'email', label: 'Email address' },
      { name: 'message', type: 'text', label: 'Message' },
    ],
  },
  'lead.capture': {
    title: 'Get started',
    fields: [
      { name: 'name', type: 'text', label: 'Name' },
      { name: 'email', type: 'email', label: 'Email address' },
    ],
  },
};

function renderIntentForm(intent: string): string {
  const spec = FORM_INTENTS[intent];
  const fields = spec.fields
    .map(
      (field) =>
        `\n          <label className="flex flex-col gap-1 text-sm text-muted-foreground"><span>${field.label}</span><input type="${field.type}" name="${field.name}" required className="rounded-md border border-border bg-background px-3 py-2 text-foreground" /></label>`,
    )
    .join('');
  return `\n      <section className="mt-8" data-ut-generated-intent="${intent}">\n        <form data-intent-form="${intent}" data-demo-form="true" data-ut-intent="${intent}" data-intent="${intent}" className="mx-auto flex w-full max-w-md flex-col gap-3">\n          <h2 className="text-lg font-semibold text-foreground">${spec.title}</h2>${fields}\n          <button type="submit" data-ut-intent="${intent}" data-intent="${intent}" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground shadow transition hover:opacity-90">${labelForIntent(intent)}</button>\n        </form>\n      </section>\n`;
}

function injectIntentSurface(source: string, intent: string): string | null {
  // Canonical pages have a repeated SectionRenderer. Inject once at the page
  // boundary so a required action is not duplicated inside every section.
  // A page that already renders a form never receives a second one.
  if (FORM_INTENTS[intent] && /<form\b|from\s+['"]@\/unison\/design-sources\/Contact['"]/.test(source)) return null;
  const closeIndex = bodyInsertionIndex(source);
  if (closeIndex < 0) return null;

  const label = labelForIntent(intent);
  const surface = FORM_INTENTS[intent]
    ? renderIntentForm(intent)
    : `\n      <div className="mt-8 flex justify-center" data-ut-generated-intent="${intent}">\n        <button type="button" data-ut-intent="${intent}" data-intent="${intent}" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground shadow transition hover:opacity-90">${label}</button>\n      </div>\n`;
  return source.slice(0, closeIndex) + surface + source.slice(closeIndex);
}


/**
 * Closes every required industry intent over renderable TSX source. The input
 * profile is the single source of truth, so a newly added industry contract is
 * enforced without adding another wizard-specific repair branch.
 */
export function closeRequiredIndustryIntents(
  files: Record<string, string>,
  industry: string | undefined | null,
  activeIntents?: readonly string[],
): RequiredIntentClosureResult {
  const profile = industry ? getIndustryIntentProfile(industry) : undefined;
  const activeIntentSet = activeIntents ? new Set(activeIntents) : null;
  const required = (profile?.required || []).filter((intent) =>
    !NON_DOM_INTENTS.has(intent) && (!activeIntentSet || activeIntentSet.has(intent)),
  );
  if (required.length === 0) return { files, injected: [], missing: [] };

  const next = { ...files };
  const tsxPaths = Object.keys(next).filter((path) => /\.(?:tsx|jsx)$/i.test(path));
  const injected: string[] = [];
  const missing: string[] = [];

  for (const intent of required) {
    if (tsxPaths.some((path) => hasIntent(next[path], intent))) continue;
    // One lead form serves contact, lead and quote enquiries; never add a second.
    if (LEAD_FORM_INTENTS.has(intent) && tsxPaths.some((path) => hasLeadForm(next[path]))) continue;

    const paths = preferredFilePaths(intent)
      .flatMap((pattern) => tsxPaths.filter((path) => pattern.test(path)))
      .concat(tsxPaths.filter((path) => !preferredFilePaths(intent).some((pattern) => pattern.test(path))));
    let applied = false;

    for (const path of paths) {
      const repaired = injectIntentSurface(next[path], intent);
      if (!repaired) continue;
      next[path] = repaired;
      injected.push(intent);
      applied = true;
      break;
    }

    if (!applied) missing.push(intent);
  }

  return { files: next, injected, missing };
}
