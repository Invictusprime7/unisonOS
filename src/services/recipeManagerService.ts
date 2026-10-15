/**
 * Recipe Manager Service
 * 
 * Manages automation recipe packs - installation, configuration, and execution.
 * Recipes are pre-built automation workflows specific to business types.
 */

import { supabase } from '@/integrations/supabase/client';

// ============ TYPES ============

export interface RecipePack {
  id: string;
  name: string;
  description: string;
  industry: string;
  tier: 'free' | 'pro' | 'enterprise';
  recipes: Recipe[];
  iconUrl?: string;
  color?: string;
}

export interface PersistedRecipePack {
  pack_id: string;
  name: string;
  description?: string | null;
  industry: string;
  tier?: string | null;
  recipes?: unknown;
}

const LEGACY_BUILT_IN_PACK_IDS: Record<string, string> = {
  'salon-starter': 'salon_basic',
  'contractor-starter': 'contractor_basic',
  'restaurant-starter': 'restaurant_basic',
};

export function resolvePersistedRecipePack(
  packId: string,
  builtIn: RecipePack | undefined,
  persistedPacks: PersistedRecipePack[],
): PersistedRecipePack | null {
  const exact = persistedPacks.find((pack) => pack.pack_id === packId);
  if (exact) return exact;
  if (!builtIn) return null;
  const legacyId = LEGACY_BUILT_IN_PACK_IDS[builtIn.id];
  const legacy = legacyId ? persistedPacks.find((pack) => pack.pack_id === legacyId) : undefined;
  if (legacy) return legacy;

  const industryMatches = persistedPacks.filter(
    (pack) => pack.industry.trim().toLowerCase() === builtIn.industry.trim().toLowerCase(),
  );
  return industryMatches.length === 1 ? industryMatches[0] : null;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  trigger: string; // Intent that triggers this recipe
  category: string;
  steps: RecipeStep[];
  defaultEnabled: boolean;
}

export interface RecipeStep {
  type: 'action' | 'wait' | 'condition' | 'goal';
  actionType?: string; // 'send_email', 'send_sms', 'create_task', etc.
  config: Record<string, unknown>;
  waitDuration?: string; // '1h', '24h', '7d'
}

export interface InstalledPack {
  id: string;
  packId: string;
  packName: string;
  industry: string;
  enabled: boolean;
  installedAt: string;
  customConfig?: Record<string, unknown>;
}

export interface RecipeToggle {
  recipeId: string;
  recipeName: string;
  enabled: boolean;
  customConfig?: Record<string, unknown>;
  lastExecuted?: string;
  executionCount: number;
}

// ============ BUILT-IN RECIPE PACKS ============

export const BUILT_IN_RECIPE_PACKS: RecipePack[] = [
  {
    id: 'salon-starter',
    name: 'Salon Starter Pack',
    description: 'Essential automations for salons and beauty businesses',
    industry: 'salon',
    tier: 'free',
    color: '#ec4899',
    recipes: [
      {
        id: 'salon-booking-confirm',
        name: 'Booking Confirmation',
        description: 'Send confirmation after booking is created',
        trigger: 'booking.create',
        category: 'booking',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_sms', config: { template: 'booking_confirm' } },
          { type: 'action', actionType: 'send_email', config: { template: 'booking_confirm_email' } },
        ],
      },
      {
        id: 'salon-24h-reminder',
        name: '24-Hour Reminder',
        description: 'Remind customers 24 hours before appointment',
        trigger: 'booking.confirmed',
        category: 'booking',
        defaultEnabled: true,
        steps: [
          { type: 'wait', waitDuration: '24h', config: { calculateFrom: 'booking.scheduledAt', direction: 'before' } },
          { type: 'action', actionType: 'send_sms', config: { template: 'reminder_24h' } },
        ],
      },
      {
        id: 'salon-review-request',
        name: 'Review Request',
        description: 'Request a review after appointment completion',
        trigger: 'job.completed',
        category: 'review',
        defaultEnabled: true,
        steps: [
          { type: 'wait', waitDuration: '2h', config: {} },
          { type: 'action', actionType: 'send_sms', config: { template: 'review_request' } },
        ],
      },
    ],
  },
  {
    id: 'contractor-starter',
    name: 'Contractor Starter Pack',
    description: 'Lead follow-up and job management for contractors',
    industry: 'contractor',
    tier: 'free',
    color: '#f59e0b',
    recipes: [
      {
        id: 'contractor-lead-followup',
        name: 'Lead Follow-up Sequence',
        description: 'Automated follow-up for new quote requests',
        trigger: 'lead.capture',
        category: 'lead',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'quote_received' } },
          { type: 'wait', waitDuration: '30m', config: {} },
          { type: 'action', actionType: 'send_sms', config: { template: 'intro_text' } },
          { type: 'wait', waitDuration: '24h', config: {} },
          { type: 'action', actionType: 'create_task', config: { title: 'Follow up call', assignTo: 'owner' } },
        ],
      },
      {
        id: 'contractor-job-complete',
        name: 'Job Completion',
        description: 'Invoice and review request after job completion',
        trigger: 'job.completed',
        category: 'job',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'job_complete_invoice' } },
          { type: 'wait', waitDuration: '3d', config: {} },
          { type: 'action', actionType: 'send_sms', config: { template: 'review_request' } },
        ],
      },
    ],
  },
  {
    id: 'restaurant-starter',
    name: 'Restaurant Starter Pack',
    description: 'Reservation management and customer engagement',
    industry: 'restaurant',
    tier: 'free',
    color: '#ef4444',
    recipes: [
      {
        id: 'restaurant-reservation-confirm',
        name: 'Reservation Confirmation',
        description: 'Confirm reservations immediately',
        trigger: 'booking.create',
        category: 'booking',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_sms', config: { template: 'reservation_confirm' } },
        ],
      },
      {
        id: 'restaurant-2h-reminder',
        name: '2-Hour Reminder',
        description: 'Remind guests 2 hours before reservation',
        trigger: 'booking.confirmed',
        category: 'booking',
        defaultEnabled: true,
        steps: [
          { type: 'wait', waitDuration: '2h', config: { calculateFrom: 'booking.scheduledAt', direction: 'before' } },
          { type: 'action', actionType: 'send_sms', config: { template: 'reminder_2h' } },
        ],
      },
      {
        id: 'restaurant-noshow-followup',
        name: 'No-Show Follow-up',
        description: 'Reach out after a no-show',
        trigger: 'booking.noshow',
        category: 'booking',
        defaultEnabled: false,
        steps: [
          { type: 'wait', waitDuration: '1h', config: {} },
          { type: 'action', actionType: 'send_email', config: { template: 'noshow_followup' } },
        ],
      },
    ],
  },
  {
    id: 'ecommerce-starter',
    name: 'E-commerce Starter Pack',
    description: 'Cart abandonment and order lifecycle',
    industry: 'ecommerce',
    tier: 'free',
    color: '#22c55e',
    recipes: [
      {
        id: 'ecom-cart-abandoned',
        name: 'Cart Abandonment Recovery',
        description: 'Recover abandoned carts with email sequence',
        trigger: 'cart.abandoned',
        category: 'cart',
        defaultEnabled: true,
        steps: [
          { type: 'wait', waitDuration: '1h', config: {} },
          { type: 'action', actionType: 'send_email', config: { template: 'cart_reminder' } },
          { type: 'wait', waitDuration: '24h', config: {} },
          { type: 'action', actionType: 'send_email', config: { template: 'cart_discount' } },
        ],
      },
      {
        id: 'ecom-order-confirm',
        name: 'Order Confirmation',
        description: 'Confirm orders and provide tracking',
        trigger: 'order.created',
        category: 'order',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'order_confirm' } },
        ],
      },
      {
        id: 'ecom-shipping-notify',
        name: 'Shipping Notification',
        description: 'Notify when order ships',
        trigger: 'order.shipped',
        category: 'order',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'order_shipped' } },
          { type: 'action', actionType: 'send_sms', config: { template: 'shipping_sms' } },
        ],
      },
    ],
  },
  {
    id: 'agency-starter',
    name: 'Agency Starter Pack',
    description: 'Client management and proposal automation',
    industry: 'agency',
    tier: 'free',
    color: '#8b5cf6',
    recipes: [
      {
        id: 'agency-consultation-booked',
        name: 'Consultation Booked',
        description: 'Prepare for client consultation',
        trigger: 'booking.create',
        category: 'booking',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'consultation_confirm' } },
          { type: 'action', actionType: 'create_task', config: { title: 'Prepare for consultation', dueIn: '1d' } },
        ],
      },
      {
        id: 'agency-proposal-followup',
        name: 'Proposal Follow-up',
        description: 'Follow up after sending proposal',
        trigger: 'proposal.sent',
        category: 'sales',
        defaultEnabled: true,
        steps: [
          { type: 'wait', waitDuration: '2d', config: {} },
          { type: 'action', actionType: 'send_email', config: { template: 'proposal_followup' } },
          { type: 'wait', waitDuration: '5d', config: {} },
          { type: 'action', actionType: 'create_task', config: { title: 'Call to discuss proposal' } },
        ],
      },
      {
        id: 'agency-deal-won',
        name: 'Deal Won - Onboarding',
        description: 'Start client onboarding when deal closes',
        trigger: 'deal.won',
        category: 'client',
        defaultEnabled: true,
        steps: [
          { type: 'action', actionType: 'send_email', config: { template: 'welcome_client' } },
          { type: 'action', actionType: 'create_task', config: { title: 'Schedule kickoff call' } },
          { type: 'action', actionType: 'create_task', config: { title: 'Send onboarding questionnaire' } },
        ],
      },
    ],
  },
];

export function resolveBuiltInRecipePack(persistedPackId: string): RecipePack | null {
  return BUILT_IN_RECIPE_PACKS.find(
    (pack) => pack.id === persistedPackId || LEGACY_BUILT_IN_PACK_IDS[pack.id] === persistedPackId,
  ) ?? null;
}

// ============ SERVICE FUNCTIONS ============

/**
 * Get all available recipe packs (built-in + custom)
 */
export async function getAvailableRecipePacks(businessId?: string): Promise<RecipePack[]> {
  // Start with built-in packs
  const packs = [...BUILT_IN_RECIPE_PACKS];

  // TODO: Fetch custom/marketplace packs from database
  if (businessId) {
    try {
      const { data } = await supabase
        .from('automation_recipe_packs')
        .select('pack_id, name, description, industry, tier, recipes')
        .eq('is_published', true);
      
      if (data) {
        data.forEach(pack => {
          // Don't duplicate built-in packs
          if (!packs.find(p => p.id === pack.pack_id)) {
            packs.push({
              id: pack.pack_id,
              name: pack.name,
              description: pack.description || '',
              industry: pack.industry,
              tier: (pack.tier as 'free' | 'pro' | 'enterprise') || 'free',
              recipes: (pack.recipes as unknown as Recipe[]) || [],
            });
          }
        });
      }
    } catch (error) {
      console.error('[RecipeManager] Error fetching custom packs:', error);
    }
  }

  return packs;
}

/**
 * Get installed packs for a business
 */
export async function getInstalledPacks(businessId: string): Promise<InstalledPack[]> {
  try {
    const { data, error } = await supabase
      .from('installed_recipe_packs')
      .select('id, pack_id, enabled')
      .eq('business_id', businessId);

    if (error) {
      console.error('[RecipeManager] Error fetching installed packs:', error);
      return [];
    }

    const { data: persistedPacks } = await supabase
      .from('automation_recipe_packs')
      .select('pack_id, name, industry');
    const persistedById = new Map((persistedPacks || []).map((pack) => [pack.pack_id, pack]));

    return (data || []).map(row => {
      const persisted = persistedById.get(row.pack_id);
      const builtIn = resolveBuiltInRecipePack(row.pack_id) ?? undefined;
      return {
        id: row.id,
        packId: builtIn?.id ?? row.pack_id,
        packName: builtIn?.name ?? persisted?.name ?? row.pack_id,
        industry: builtIn?.industry ?? persisted?.industry ?? '',
        enabled: row.enabled,
        installedAt: new Date().toISOString(),
        customConfig: undefined,
      };
    });
  } catch (error) {
    console.error('[RecipeManager] Error fetching installed packs:', error);
    return [];
  }
}

/**
 * Install a recipe pack for a business
 */
export async function installRecipePack(
  businessId: string,
  packId: string,
  options: { enableAll?: boolean } = {}
): Promise<{ success: boolean; installedId?: string; error?: string }> {
  try {
    const builtIn = BUILT_IN_RECIPE_PACKS.find(p => p.id === packId);
    const { data: persistedPacks, error: packsError } = await supabase
      .from('automation_recipe_packs')
      .select('pack_id, name, description, industry, tier, recipes')
      .eq('is_published', true);

    if (packsError) return { success: false, error: packsError.message };
    const persistedPack = resolvePersistedRecipePack(packId, builtIn, (persistedPacks ?? []) as PersistedRecipePack[]);
    if (!persistedPack) {
      return {
        success: false,
        error: builtIn
          ? `No unique published database pack is configured for ${builtIn.industry}.`
          : 'Pack not found or not published.',
      };
    }

    // Check if already installed
    const { data: existing } = await supabase
      .from('installed_recipe_packs')
      .select('id')
      .eq('business_id', businessId)
      .eq('pack_id', persistedPack.pack_id)
      .single();

    if (existing) {
      return { success: false, error: 'Pack already installed' };
    }

    // Install the pack
    const { data, error } = await supabase
      .from('installed_recipe_packs')
      .insert({
        business_id: businessId,
        pack_id: persistedPack.pack_id,
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Create recipe toggles for each recipe
    const persistedRecipes = Array.isArray(persistedPack.recipes)
      ? persistedPack.recipes as Recipe[]
      : [];
    const recipes = persistedRecipes.length > 0 ? persistedRecipes : builtIn?.recipes ?? [];
    if (recipes.length > 0) {
      const toggles = recipes.filter((recipe) => typeof recipe.id === 'string').map(recipe => ({
        business_id: businessId,
        recipe_id: recipe.id,
        enabled: options.enableAll ?? recipe.defaultEnabled ?? true,
      }));

      if (toggles.length > 0) {
        await supabase
          .from('business_recipe_toggles')
          .upsert(toggles, { onConflict: 'business_id,recipe_id' });
      }
    }

    return { success: true, installedId: data.id };
  } catch (error) {
    console.error('[RecipeManager] Error installing pack:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Uninstall a recipe pack
 */
export async function uninstallRecipePack(
  businessId: string,
  packId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('installed_recipe_packs')
      .delete()
      .eq('business_id', businessId)
      .eq('pack_id', packId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[RecipeManager] Error uninstalling pack:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get recipe toggles for a business
 */
export async function getRecipeToggles(businessId: string): Promise<RecipeToggle[]> {
  try {
    const { data, error } = await supabase
      .from('business_recipe_toggles')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      console.error('[RecipeManager] Error fetching toggles:', error);
      return [];
    }

    // Enrich with recipe names from built-in packs
    return (data || []).map(toggle => {
      let recipeName = toggle.recipe_id;
      for (const pack of BUILT_IN_RECIPE_PACKS) {
        const recipe = pack.recipes.find(r => r.id === toggle.recipe_id);
        if (recipe) {
          recipeName = recipe.name;
          break;
        }
      }
      return {
        recipeId: toggle.recipe_id,
        recipeName,
        enabled: toggle.enabled,
        customConfig: (toggle.custom_config as Record<string, unknown>) || undefined,
        executionCount: 0, // TODO: Calculate from execution logs
      };
    });
  } catch (error) {
    console.error('[RecipeManager] Error fetching toggles:', error);
    return [];
  }
}

/**
 * Toggle a recipe on/off
 */
export async function toggleRecipe(
  businessId: string,
  recipeId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('business_recipe_toggles')
      .upsert({
        business_id: businessId,
        recipe_id: recipeId,
        enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,recipe_id',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[RecipeManager] Error toggling recipe:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get recipes that match a specific intent
 */
export function getRecipesForIntent(intent: string, installedPacks: InstalledPack[]): Recipe[] {
  const recipes: Recipe[] = [];
  
  for (const installedPack of installedPacks) {
    if (!installedPack.enabled) continue;
    
    const pack = BUILT_IN_RECIPE_PACKS.find(p => p.id === installedPack.packId);
    if (!pack) continue;
    
    const matching = pack.recipes.filter(r => r.trigger === intent);
    recipes.push(...matching);
  }
  
  return recipes;
}

/**
 * Get recommended packs based on business type
 */
export function getRecommendedPacks(industry?: string): RecipePack[] {
  if (!industry) {
    return BUILT_IN_RECIPE_PACKS.filter(p => p.tier === 'free').slice(0, 3);
  }
  
  const exactMatch = BUILT_IN_RECIPE_PACKS.filter(
    p => p.industry.toLowerCase() === industry.toLowerCase()
  );
  
  if (exactMatch.length > 0) {
    return exactMatch;
  }
  
  // Return generic packs
  return BUILT_IN_RECIPE_PACKS.filter(p => p.tier === 'free').slice(0, 2);
}
