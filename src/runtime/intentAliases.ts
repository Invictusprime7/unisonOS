/**
 * Intent Aliases — MIGRATION BRIDGE ONLY
 * 
 * @deprecated This module exists solely as a migration bridge.
 * All new templates MUST use canonical CoreIntents directly from coreIntents.ts.
 * Aliases should NOT be relied upon for new code — they will be removed
 * once all legacy templates are migrated to the section registry.
 * 
 * The canonical pipeline is:
 *   BusinessBlueprint → ContractCompiler → canonical intents only
 * 
 * See src/contracts/ for the new canonical system.
 * 
 * RULE: Everything normalizes to CORE_INTENTS before execution.
 */

import type { CoreIntent } from '@/platform/core/coreIntents';
import { CORE_INTENTS } from '@/platform/core/coreIntents';

/**
 * Comprehensive alias map: legacy/alternate intent → canonical CoreIntent
 * 
 * Every intent string that might be emitted by templates or old code
 * should have an entry here pointing to its canonical form.
 */
export const INTENT_ALIASES: Record<string, CoreIntent> = {
  // ============ NAVIGATION ALIASES ============
  'nav.goto_page': 'nav.goto',
  'nav.to': 'nav.goto',
  'nav.navigate': 'nav.goto',
  'nav.page': 'nav.goto',
  'nav.internal': 'nav.goto',
  'nav.route': 'nav.goto',
  'nav.open': 'nav.goto',
  'nav.scroll': 'nav.anchor',
  'nav.external_link': 'nav.external',
  'nav.open_external': 'nav.external',
  'nav.back': 'nav.goto', // Treat back as goto with special handling
  'nav.open_overlay': 'nav.goto', // Overlays map to goto with modal payload

  // ============ PAYMENT/CHECKOUT ALIASES ============
  'shop.checkout': 'pay.checkout',
  'checkout.start': 'pay.checkout',
  'checkout.begin': 'pay.checkout',
  'payment.start': 'pay.checkout',
  'payment.checkout': 'pay.checkout',
  'stripe.checkout': 'pay.checkout',
  'pay.start': 'pay.checkout',
  'pay.begin': 'pay.checkout',
  'checkout.complete': 'pay.success',
  'payment.success': 'pay.success',
  'checkout.cancel': 'pay.cancel',
  'payment.cancel': 'pay.cancel',

  // ============ CONTACT/LEAD ALIASES ============
  'lead.submit': 'contact.submit',
  'lead.submit_form': 'contact.submit',
  'lead.capture_form': 'lead.capture',
  'lead.open_form': 'contact.submit', // Opens form modal, same flow
  'contact.send': 'contact.submit',
  'contact.form': 'contact.submit',
  'contact.message': 'contact.submit',
  'form.submit': 'contact.submit', // Generic form → contact
  'inquiry.submit': 'contact.submit',
  'inquiry.send': 'contact.submit',
  'message.send': 'contact.submit',
  'sales.contact': 'contact.submit',
  'project.inquire': 'contact.submit',

  // ============ NEWSLETTER ALIASES ============
  'newsletter.submit': 'newsletter.subscribe',
  'newsletter.signup': 'newsletter.subscribe',
  'newsletter.join': 'newsletter.subscribe',
  'newsletter.open': 'newsletter.subscribe',
  'email.subscribe': 'newsletter.subscribe',
  'subscribe': 'newsletter.subscribe',
  'waitlist.join': 'newsletter.subscribe', // Waitlist is newsletter variant
  'waitlist.submit': 'newsletter.subscribe',

  // ============ BOOKING ALIASES ============
  'booking.open': 'booking.create',
  'booking.start': 'booking.create',
  'booking.new': 'booking.create',
  'booking.submit': 'booking.create',
  'booking.request': 'booking.create',
  'booking.select_service': 'booking.create',
  'calendar.book': 'booking.create',
  'calendar.schedule': 'booking.create',
  'appointment.book': 'booking.create',
  'appointment.create': 'booking.create',
  'appointment.schedule': 'booking.create',
  'reserve': 'booking.create',
  'reservation.create': 'booking.create',
  'reservation.make': 'booking.create',
  'demo.book': 'booking.create',
  'call.schedule': 'booking.create',
  'consultation.book': 'consultation.request',

  // ============ QUOTE ALIASES ============
  'quote.submit': 'quote.request',
  'quote.open': 'quote.request',
  'quote.get': 'quote.request',
  'estimate.request': 'quote.request',
  'estimate.get': 'quote.request',
  'pricing.request': 'quote.request',

  // ============ CART ALIASES ============
  'shop.add_to_cart': 'cart.add',
  'cart.add_item': 'cart.add',
  'product.add_to_cart': 'cart.add',
  'shop.open_cart': 'cart.view',
  'cart.open': 'cart.view',
  'cart.show': 'cart.view',
  'cart.change_quantity': 'cart.update',
  'cart.delete_item': 'cart.remove',
  'checkout.open': 'cart.checkout',
  'shop.view_product': 'product.view',
  'product.favorite': 'favorite.toggle',
  'wishlist.add': 'favorite.toggle',

  // ============ AUTH ALIASES ============
  'auth.sign_in': 'auth.login',
  'auth.signin': 'auth.login',
  'login': 'auth.login',
  'signin': 'auth.login',
  'user.login': 'auth.login',
  'auth.sign_up': 'auth.register',
  'auth.signup': 'auth.register',
  'signup': 'auth.register',
  'register': 'auth.register',
  'user.register': 'auth.register',
  'auth.sign_out': 'auth.logout',
  'logout': 'auth.logout',
  'user.account': 'account.open',

  // ============ TRIAL/DEMO ALIASES (SaaS) ============
  'trial.start': 'auth.register', // Free trial = registration
  'trial.begin': 'auth.register',
  'trial.signup': 'auth.register',
  'demo.start': 'booking.create',
  'demo.watch': 'nav.goto', // Video demo is navigation

  // ============ COMMUNICATION ALIASES ============
  'call.now': 'contact.call',
  'call.open': 'contact.call',
  'phone.call': 'contact.call',
  'email.now': 'contact.email',
  'email.open': 'contact.email',
  'sms.send': 'contact.sms',
  'directions.open': 'location.directions',
  'map.open': 'location.directions',

  // ============ SOCIAL/SHARE ALIASES ============
  'social.share': 'share.open',
  'share': 'share.open',
  'share.page': 'share.open',

  // ============ FORM SPECIFIC ALIASES ============
  'form.contact': 'contact.submit',
  'form.lead': 'lead.capture',
  'form.booking': 'booking.create',
  'form.quote': 'quote.request',
  'form.newsletter': 'newsletter.subscribe',

  // ============ MISC ALIASES ============
  'portfolio.view': 'nav.goto',
  'case.study': 'nav.goto',
  'menu.view': 'nav.goto',
  'services.view': 'nav.goto',
  'pricing.view': 'nav.goto',
  'resume.download': 'content.download',
  'document.download': 'content.download',
  'brochure.download': 'content.download',
  'menu.download': 'content.download',
  'report.download': 'content.download',
  'media-kit.download': 'content.download',
  'download': 'content.download',
  'donate.now': 'donation.start',
  'donate.start': 'donation.start',
  'view.more': 'nav.goto',
  'learn.more': 'nav.goto',
  'get.started': 'auth.register',
};

/**
 * Normalize any intent string to a canonical CoreIntent
 * 
 * @param intent - The raw intent string (may be alias or canonical)
 * @returns The canonical CoreIntent, or the original if no alias exists
 */
export function normalizeIntent(intent: string): CoreIntent | string {
  // Already canonical?
  if ((CORE_INTENTS as readonly string[]).includes(intent)) {
    return intent as CoreIntent;
  }

  // Check alias map
  const aliased = INTENT_ALIASES[intent];
  if (aliased) {
    console.log(`[IntentAliases] Normalized "${intent}" → "${aliased}"`);
    return aliased;
  }

  // Check with lowercase (case-insensitive fallback)
  const lowerIntent = intent.toLowerCase();
  const aliasedLower = INTENT_ALIASES[lowerIntent];
  if (aliasedLower) {
    console.log(`[IntentAliases] Normalized (case-insensitive) "${intent}" → "${aliasedLower}"`);
    return aliasedLower;
  }

  // Try extracting domain.action pattern (lowercase for matching)
  const lowerParts = lowerIntent.split('.');
  if (lowerParts.length >= 2) {
    const domain = lowerParts[0];
    
    // Try domain-based fallbacks
    const domainFallbacks: Record<string, CoreIntent> = {
      'nav': 'nav.goto',
      'cart': 'cart.add',
      'shop': 'cart.add',
      'pay': 'pay.checkout',
      'checkout': 'pay.checkout',
      'booking': 'booking.create',
      'contact': 'contact.submit',
      'lead': 'lead.capture',
      'newsletter': 'newsletter.subscribe',
      'auth': 'auth.login',
      'account': 'account.open',
      'search': 'search.open',
      'filter': 'filter.open',
      'sort': 'sort.open',
      'favorite': 'favorite.toggle',
      'location': 'location.directions',
      'donation': 'donation.start',
      'form': 'form.submit',
    };
    
    if (domainFallbacks[domain]) {
      console.log(`[IntentAliases] Domain fallback "${intent}" → "${domainFallbacks[domain]}"`);
      return domainFallbacks[domain];
    }
  }

  // Return original (executor should handle gracefully)
  console.warn(`[IntentAliases] No alias found for "${intent}", returning as-is`);
  return intent;
}

/**
 * Check if an intent (after normalization) is a valid CoreIntent
 */
export function isNormalizedCoreIntent(intent: string): boolean {
  const normalized = normalizeIntent(intent);
  return (CORE_INTENTS as readonly string[]).includes(normalized);
}

/**
 * Get the canonical intent for display/debugging
 */
export function getCanonicalIntent(intent: string): string {
  return normalizeIntent(intent) as string;
}

/**
 * Get all registered aliases for a canonical intent
 */
export function getAliasesFor(canonicalIntent: CoreIntent): string[] {
  return Object.entries(INTENT_ALIASES)
    .filter(([_, canonical]) => canonical === canonicalIntent)
    .map(([alias, _]) => alias);
}
