/**
 * Automation Orchestrator
 *
 * The central bridge that wires together:
 *   Intent Executor → Recipe Matching → Inngest Events → Recipe Execution
 *
 * This is the "hidden automation layer" that makes every generated website
 * come alive with business automations out of the box.
 *
 * Pipeline position:
 *   Systems AI → Intent Router → Business Blueprint → Template Engine
 *       → **Automation Orchestrator** → Working Business Website
 */

import type { CoreIntent } from '@/platform/core/coreIntents';
import { isActionIntent, isAutomationIntent } from '@/platform/core/coreIntents';
import { getIndustryProfile, normalizeIndustryKey } from '@/platform/core/industryMatrix';
import { isAutomatable } from '@/runtime/intentClassifier';
import {
  BUILT_IN_RECIPE_PACKS,
  getRecipesForIntent,
  installRecipePack,
  getInstalledPacks,
  getRecipeToggles,
  type RecipePack,
  type Recipe,
  type RecipeStep,
  type InstalledPack,
} from './recipeManagerService';
import {
  upsertIntentBinding,
  lookupBindingsByIntent,
  type IntentBinding,
} from './intentBindingService';
import { sendInngestEvent, triggerAutomation } from './inngestService';
import type { InngestEvents } from '@/lib/inngest';
import type { IntentContext, IntentResult, EmittedEvent } from '@/runtime/intentExecutor';

// ============================================================================
// Industry Normalization
// ============================================================================

const RECIPE_INDUSTRY_ALIASES: Record<string, string> = {
  'local-service': 'contractor',
};

export function normalizeIndustry(raw: string): string | undefined {
  const canonicalIndustry = normalizeIndustryKey(raw);
  if (!getIndustryProfile(canonicalIndustry)) return undefined;
  return RECIPE_INDUSTRY_ALIASES[canonicalIndustry] ?? canonicalIndustry;
}

export function getRecipePacksForIndustry(industry: string): RecipePack[] {
  const normalizedIndustry = normalizeIndustry(industry);
  if (!normalizedIndustry) return [];
  return BUILT_IN_RECIPE_PACKS.filter(pack => pack.industry === normalizedIndustry);
}

// ============================================================================
// Intent → Inngest Event Mapping (Single Source of Truth)
// ============================================================================

/**
 * Canonical mapping from CoreIntent to Inngest event name.
 * Both intentExecutor.ts and inngest-event-bridge.ts should defer to this.
 */
export const INTENT_EVENT_MAP: Record<string, keyof InngestEvents> = {
  // Lead/Contact
  'contact.submit': 'crm/lead.created',
  'lead.capture': 'crm/lead.created',
  'newsletter.subscribe': 'newsletter/subscribed',

  // Booking lifecycle
  'booking.create': 'booking/created',
  'booking.confirmed': 'booking/created',
  'booking.reminder': 'booking/reminder.24h',
  'booking.cancelled': 'booking/created', // reuse with status flag
  'booking.noshow': 'booking/no.show',

  // Cart/Commerce
  'cart.add': 'automation/trigger',
  'cart.checkout': 'checkout/started',
  'cart.abandoned': 'cart/abandoned',

  // Orders
  'order.created': 'order/created',
  'order.shipped': 'order/shipped',
  'order.delivered': 'order/delivered',

  // Deal lifecycle
  'deal.won': 'crm/deal.stage.changed',
  'deal.lost': 'crm/deal.stage.changed',

  // CRM Proposals
  'proposal.sent': 'automation/trigger',

  // Job lifecycle
  'job.completed': 'automation/trigger',

  // Forms
  'form.submit': 'form/submitted',

  // Generic
  'button.click': 'automation/trigger',
};

/**
 * Look up the Inngest event name for a given intent.
 */
export function getInngestEventName(intent: string): keyof InngestEvents | null {
  return INTENT_EVENT_MAP[intent] ?? null;
}

// ============================================================================
// Recipe Matching
// ============================================================================

/**
 * Find all enabled recipes that should fire for a given intent + business.
 * This is the core "hidden wiring" — the user doesn't configure anything,
 * but the right automations fire automatically.
 */
export async function findMatchingRecipes(
  intent: string,
  businessId: string
): Promise<Recipe[]> {
  // Get installed packs for this business
  const installed = await getInstalledPacks(businessId);

  if (installed.length === 0) {
    return [];
  }

  // Get recipes matching this intent from installed packs
  const matching = getRecipesForIntent(intent, installed);

  // Filter by enabled toggles
  const toggles = await getRecipeToggles(businessId);
  const enabledIds = new Set(
    toggles.filter(t => t.enabled).map(t => t.recipeId)
  );

  // If no toggles exist yet, use defaultEnabled from the recipe definition
  if (toggles.length === 0) {
    return matching.filter(r => r.defaultEnabled);
  }

  return matching.filter(r => enabledIds.has(r.id));
}

// ============================================================================
// Build Pipeline Integration
// ============================================================================

/**
 * Install the correct recipe packs for a business based on its blueprint.
 * Called during Build Pipeline Stage 5 (Automations).
 *
 * Returns the list of installed pack IDs and the intent bindings created.
 */
export async function installAutomationsForBusiness(
  businessId: string,
  projectId: string,
  industry: string,
  pages: Array<{ pageId: string; path: string; intentBindings?: Array<{ intentId: string; label: string; target: { selector: string } }> }>
): Promise<{
  installedPacks: string[];
  bindingsCreated: number;
  recipesEnabled: number;
}> {
  // 1. Find matching recipe packs
  const packsToInstall = getRecipePacksForIndustry(industry);

  const installedPacks: string[] = [];
  let recipesEnabled = 0;

  // 2. Install each pack
  for (const pack of packsToInstall) {
    const result = await installRecipePack(businessId, pack.id, { enableAll: false });
    if (result.success) {
      installedPacks.push(pack.id);
      recipesEnabled += pack.recipes.filter(r => r.defaultEnabled).length;
    }
  }

  // 3. Persist intent bindings to DB with recipe IDs attached
  let bindingsCreated = 0;
  for (const page of pages) {
    if (!page.intentBindings) continue;

    for (const binding of page.intentBindings) {
      // Find recipes that match this intent
      const matchingRecipeIds = packsToInstall.flatMap(
        pack => pack.recipes
          .filter(r => r.trigger === binding.intentId)
          .map(r => r.id)
      );

      const saved = await upsertIntentBinding({
        businessId,
        projectId,
        pagePath: page.path,
        elementKey: binding.target.selector,
        elementLabel: binding.label,
        intent: binding.intentId,
        intentConfidence: 1.0,
        recipeIds: matchingRecipeIds,
        enabled: true,
      });

      if (saved) bindingsCreated++;
    }
  }

  return { installedPacks, bindingsCreated, recipesEnabled };
}

// ============================================================================
// Runtime Automation Dispatch
// ============================================================================

/**
 * Called by the Intent Executor after a successful intent execution.
 * Handles:
 * 1. Finding matching recipes for this intent + business
 * 2. Sending the correct Inngest event
 * 3. Including recipe context so Inngest workflows know which steps to run
 *
 * This replaces the duplicated fireInngestEvent in intentExecutor.ts
 */
export async function dispatchAutomation(
  intent: string,
  ctx: IntentContext,
  result: IntentResult
): Promise<{ dispatched: boolean; recipesMatched: number; eventName?: string }> {
  if (!ctx.businessId) {
    return { dispatched: false, recipesMatched: 0 };
  }

  // Deterministic gate: only dispatch for automatable intents
  if (!isAutomatable(intent)) {
    return { dispatched: false, recipesMatched: 0 };
  }

  // 1. Find matching recipes
  const matchingRecipes = await findMatchingRecipes(intent, ctx.businessId);

  // 2. Resolve Inngest event name
  const eventName = getInngestEventName(intent);
  if (!eventName) {
    // If no Inngest mapping, still use generic automation/trigger
    if (matchingRecipes.length > 0) {
      const sendResult = await triggerAutomation({
        automationId: intent.replace('.', '-'),
        businessId: ctx.businessId,
        triggerType: intent,
        payload: {
          ...(ctx.payload || {}),
          _recipes: matchingRecipes.map(r => r.id),
          _recipeSteps: matchingRecipes.flatMap(r => r.steps),
        },
      });
      return {
        dispatched: sendResult.success,
        recipesMatched: matchingRecipes.length,
        eventName: 'automation/trigger',
      };
    }
    return { dispatched: false, recipesMatched: 0 };
  }

  // 3. Build event data with recipe context
  const eventData = buildEventData(intent, ctx, result, matchingRecipes);

  // 4. Send to Inngest
  const sendResult = await sendInngestEvent(eventName, eventData as never);

  return {
    dispatched: sendResult.success,
    recipesMatched: matchingRecipes.length,
    eventName,
  };
}

/**
 * Build Inngest event data from intent context, merging recipe info
 */
function buildEventData(
  intent: string,
  ctx: IntentContext,
  result: IntentResult,
  recipes: Recipe[]
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    businessId: ctx.businessId || 'unknown',
    timestamp: new Date().toISOString(),
    source: 'intent-executor',
    _intent: intent,
    _recipes: recipes.map(r => ({ id: r.id, name: r.name, steps: r.steps })),
  };

  const payload = ctx.payload || {};
  const resultData = (result.data || {}) as Record<string, unknown>;

  switch (intent) {
    case 'contact.submit':
    case 'lead.capture':
      return {
        ...base,
        leadId: resultData.leadId || `lead_${Date.now()}`,
        email: payload.email,
        phone: payload.phone,
        source: payload.source || 'website',
      };

    case 'booking.create':
      return {
        ...base,
        bookingId: resultData.bookingId || `booking_${Date.now()}`,
        contactEmail: payload.customerEmail,
        contactPhone: payload.customerPhone,
        service: payload.serviceName || 'General Appointment',
        scheduledAt: payload.datetime || new Date().toISOString(),
      };

    case 'newsletter.subscribe':
      return {
        ...base,
        subscriptionId: `sub_${Date.now()}`,
        email: payload.email,
        lists: payload.lists,
        source: payload.source || 'website',
      };

    case 'cart.checkout':
      return {
        ...base,
        checkoutId: `checkout_${Date.now()}`,
        items: payload.items || [],
        total: payload.total,
        customerEmail: payload.email,
      };

    case 'cart.abandoned':
      return {
        ...base,
        cartId: payload.cartId || `cart_${Date.now()}`,
        items: payload.items || [],
        total: payload.total,
        customerEmail: payload.email,
        lastActivityAt: new Date().toISOString(),
      };

    case 'order.created':
      return {
        ...base,
        orderId: resultData.orderId || `order_${Date.now()}`,
        customerEmail: payload.email,
        items: payload.items || [],
        total: payload.total || 0,
      };

    case 'order.shipped':
      return {
        ...base,
        orderId: payload.orderId,
        customerEmail: payload.email,
        trackingNumber: payload.trackingNumber,
        carrier: payload.carrier,
      };

    case 'deal.won':
    case 'deal.lost':
      return {
        ...base,
        dealId: payload.dealId || `deal_${Date.now()}`,
        previousStage: payload.previousStage || 'negotiation',
        newStage: intent === 'deal.won' ? 'closed_won' : 'closed_lost',
        contactEmail: payload.contactEmail,
      };

    default:
      return {
        ...base,
        automationId: intent.replace('.', '-'),
        triggerId: `trigger_${Date.now()}`,
        triggerType: intent,
        payload,
      };
  }
}
