/**
 * Canonical page affinity for visitor-facing actions.
 *
 * Both launch preflight and the live preview consume this data-only vocabulary.
 * It deliberately describes destinations, not execution, so it extends the
 * existing nav intent instead of creating a second router or action registry.
 */

export const PAGE_ROLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  home: ['home'],
  services: ['services', 'service', 'our services', 'what we do', 'offerings', 'treatments'],
  pricing: ['pricing', 'plans', 'packages', 'price', 'price list', 'rates'],
  about: ['about', 'about us', 'our story', 'who we are', 'profile'],
  contact: ['contact', 'contact us', 'get in touch', 'reach us', 'get a quote'],
  booking: ['book', 'book now', 'book online', 'booking', 'reserve', 'schedule', 'appointment'],
  shop: ['shop', 'store', 'products', 'collection', 'catalog', 'browse', 'shop now', 'buy'],
  cart: ['cart', 'view cart', 'bag', 'basket'],
  checkout: ['checkout', 'check out'],
  donate: ['donate', 'donate now', 'give', 'support us', 'contribute'],
  blog: ['blog', 'articles', 'news', 'journal', 'resources', 'insights', 'read more'],
  gallery: [
    'case study', 'case studies', 'success story', 'success stories',
    'gallery', 'portfolio', 'work', 'our work', 'projects', 'selected work', 'lookbook',
  ],
  faq: ['faq', 'faqs', 'questions'],
  menu: ['menu', 'our menu', 'view menu', 'food menu', 'drinks menu'],
  team: ['team', 'our team', 'staff', 'people'],
  events: ['events', 'event', 'upcoming events'],
  account: ['account', 'my account', 'sign in', 'log in', 'login'],
};

const INTENT_DESTINATIONS: Readonly<Record<string, readonly string[]>> = {
  'pay.checkout': ['checkout', 'cart', 'pricing'],
  'cart.checkout': ['cart', 'checkout'],
  'product.view': ['products', 'shop', 'catalog'],
  'auth.login': ['login', 'signin', 'account'],
  'auth.register': ['signup', 'register', 'account'],
  'booking.create': ['booking', 'book', 'schedule', 'appointments'],
  'contact.submit': ['contact'],
  'newsletter.subscribe': ['newsletter', 'subscribe'],
  'quote.request': ['quote', 'estimate', 'contact'],
  'lead.capture': ['contact', 'lead'],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ordered page/title candidates inferred from an intent and visible CTA copy. */
export function resolveActionPageAffinity(intent?: string | null, label?: string | null): string[] {
  const candidates = [...(intent ? (INTENT_DESTINATIONS[intent] ?? []) : [])];
  const normalizedLabel = normalize(label ?? '');

  if (normalizedLabel) {
    for (const [role, aliases] of Object.entries(PAGE_ROLE_ALIASES)) {
      const matchedAliases = aliases.filter((alias) => {
        const normalizedAlias = normalize(alias);
        return normalizedLabel === normalizedAlias
          || normalizedLabel.startsWith(`${normalizedAlias} `)
          || normalizedLabel.endsWith(` ${normalizedAlias}`)
          || normalizedLabel.includes(` ${normalizedAlias} `);
      });
      if (matchedAliases.length) {
        // Prefer the exact semantic destination ("case studies") before the
        // broader role fallback ("gallery"), otherwise a portfolio page can
        // steal a case-study CTA when both routes exist.
        candidates.push(...matchedAliases, ...aliases, role);
      }
    }
  }

  return Array.from(new Set(candidates.map(normalize).filter(Boolean)));
}
