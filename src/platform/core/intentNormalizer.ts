/**
 * Intent Normalizer — Maps playground-layer intents to canonical CoreIntents.
 * 
 * The playground authoring layer uses UX-friendly intent names like
 * 'nav.goto_page' and 'calendar.open'. The runtime and compiled contract
 * layer uses canonical CoreIntents like 'nav.goto' and 'booking.create'.
 * 
 * This normalizer bridges the two so compiled bindings always carry
 * canonical intents, even when sourced from playground specs.
 */

import type { CoreIntent } from './coreIntents';
import type { PlaygroundBindingIntent } from '@/types/playground';

// ============================================================================
// Playground → Core Intent Map
// ============================================================================

const PLAYGROUND_TO_CORE: Record<PlaygroundBindingIntent, CoreIntent | ((targetType?: string) => CoreIntent)> = {
  'nav.goto_page':    'nav.goto',
  'funnel.goto_step': 'nav.goto',
  'form.open':        (targetType?: string) => {
    if (targetType === 'quote' || targetType === 'quote_request') return 'quote.request';
    if (targetType === 'newsletter' || targetType === 'waitlist') return 'newsletter.subscribe';
    if (targetType === 'lead' || targetType === 'lead_capture') return 'lead.capture';
    if (targetType && ['demo_request', 'project_inquiry', 'property_inquiry', 'consultation_intake', 'patient_intake', 'volunteer'].includes(targetType)) {
      return 'lead.capture';
    }
    return 'contact.submit';
  },
  'popup.open':       'nav.anchor',
  'calendar.open':    'booking.create',
  'checkout.start':   'pay.checkout',
  'product.view':     'product.view',
  'cart.view':        'cart.view',
  'account.open':     'account.open',
  'menu.open':        'menu.open',
  'search.open':      'search.open',
  'filter.open':      'filter.open',
  'sort.open':        'sort.open',
  'favorite.toggle':  'favorite.toggle',
  'share.open':       'share.open',
  'chat.open':        'chat.open',
  'external.open':    'nav.external',
};

/**
 * Normalize a PlaygroundBindingIntent to a canonical CoreIntent.
 * 
 * @param intent - The playground-layer intent
 * @param targetType - Optional hint about the target (e.g. 'quote', 'lead')
 * @returns The canonical CoreIntent
 */
export function normalizePlaygroundIntent(
  intent: PlaygroundBindingIntent,
  targetType?: string,
): CoreIntent {
  const mapping = PLAYGROUND_TO_CORE[intent];
  if (typeof mapping === 'function') {
    return mapping(targetType);
  }
  return mapping ?? 'nav.goto';
}

/**
 * Check if a playground intent maps to a navigation-class CoreIntent.
 */
export function isPlaygroundNavIntent(intent: PlaygroundBindingIntent): boolean {
  const core = normalizePlaygroundIntent(intent);
  return core === 'nav.goto' || core === 'nav.external' || core === 'nav.anchor';
}

// ============================================================================
// UI Action Inference
// ============================================================================

export type UIAction = 'navigate' | 'overlay' | 'state' | 'toast';

/**
 * Infer the UI action type from a playground intent.
 */
export function inferUIAction(intent: PlaygroundBindingIntent): UIAction {
  switch (intent) {
    case 'nav.goto_page':
    case 'funnel.goto_step':
    case 'external.open':
    case 'product.view':
      return 'navigate';
    case 'calendar.open':
    case 'popup.open':
    case 'form.open':
      return 'overlay';
    case 'account.open':
    case 'menu.open':
    case 'share.open':
    case 'chat.open':
      return 'overlay';
    case 'search.open':
    case 'filter.open':
    case 'sort.open':
    case 'favorite.toggle':
      return 'state';
    case 'checkout.start':
      return 'navigate';
    default:
      return 'navigate';
  }
}
