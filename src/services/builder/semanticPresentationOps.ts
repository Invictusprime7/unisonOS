/**
 * semanticPresentationOps — P1.7 of the canonical closure plan.
 *
 * Snapshot-owned visual mutations. A `PresentationOp` never rewrites page JSX:
 * it mutates the sealed `WizardDesignIntervention` (variants, composition plan,
 * motion/layout recipe) and lets the canonical compiler re-project the pages.
 *
 * One authority: every op is validated here, and a composition-plan mutation is
 * re-validated through `validateAIPageComposition` against the sealed art
 * direction pack before it is accepted — exactly the gate the generation lanes
 * pass through. Anything that would leave the plan uncertified is rejected.
 */

import type { PresentationOp } from '@/types/patchPlan';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { getVariantById } from '@/sections/variants/registry';
import type { VariantId } from '@/sections/variants/types';
import { COMPOSITION_ROLES, validateAIPageComposition, type AIPageCompositionPlan } from '@/sections/aiPageComposition';
import { resolveLegalImplementation } from '@/platform/core/resolvedImplementationContract';


export const PRESENTATION_LAYOUT_RECIPES = [
  'floating-navbar', 'collage-hero', 'bento-features', 'media-card-grid', 'conversion-form', 'rich-footer',
] as const;

export const PRESENTATION_MOTION_BUDGETS = ['restrained', 'expressive'] as const;

/** Sections the site shell owns — never removed or reordered by a visual edit. */
const CHROME_SECTIONS = new Set(['navbar', 'footer']);

type CompositionRole = (typeof COMPOSITION_ROLES)[number];

/** Map a builder/page-registry role onto the composition role vocabulary. */
export function toCompositionRole(role: string | null | undefined): CompositionRole | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const direct = COMPOSITION_ROLES.find((candidate) => candidate === normalized);
  if (direct) return direct;
  const aliases: Record<string, CompositionRole> = {
    service: 'services',
    landing: 'home',
    index: 'home',
    thankyou: 'thank_you',
    thank_you_page: 'thank_you',
    store: 'shop',
    products: 'shop',
    contact_us: 'contact',
  };
  return aliases[normalized] ?? null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requirePlanPage(plan: AIPageCompositionPlan | undefined, role: string) {
  const compositionRole = toCompositionRole(role);
  if (!plan || !compositionRole) return null;
  return plan.pages.find((page) => page.role === compositionRole) ?? null;
}

/**
 * Apply snapshot-owned presentation operations to a design intervention.
 * Throws with a user-readable reason when an op is not canonically valid.
 */
export function applySemanticPresentationOps(
  intervention: WizardDesignIntervention,
  ops: readonly PresentationOp[],
): WizardDesignIntervention {
  const next = clone(intervention);
  let planTouched = false;

  for (const op of ops) {
    switch (op.type) {
      case 'setVariant': {
        const currentVariantId = next.activeVariants[op.sectionId];
        const currentVariant = currentVariantId ? getVariantById(currentVariantId) : undefined;
        const nextVariant = getVariantById(op.variantId as VariantId);
        if (!nextVariant || (currentVariant && currentVariant.sectionType !== nextVariant.sectionType)) {
          throw new Error(`[presentation] invalid variant ${op.variantId} for section ${op.sectionId}.`);
        }
        // §8.4 — a new edit asks the resolved catalog; legacy ids are not legal here.
        const legality = resolveLegalImplementation(nextVariant.id, 'ai-edit');
        if (legality.legal !== true) throw new Error(`[presentation] ${legality.reason}`);
        next.activeVariants[op.sectionId] = nextVariant.id;
        break;
      }


      /**
       * §7.7 — "all pages" edits use inheritance. One shared family decision is
       * written to the sealed variant map; page-local overrides are cleared so
       * every page inherits it, except roles the caller named explicitly.
       */
      case 'setFamilyVariant': {
        const nextVariant = getVariantById(op.variantId as VariantId);
        if (!nextVariant || nextVariant.sectionType !== op.sectionType) {
          throw new Error(`[presentation] ${op.variantId} is not a registered ${op.sectionType} design.`);
        }
        const exceptions = new Set(
          (op.exceptPageRoles ?? []).map((role) => toCompositionRole(role)).filter(Boolean) as CompositionRole[],
        );
        let applied = false;
        for (const [sectionId, variantId] of Object.entries(next.activeVariants)) {
          const current = variantId ? getVariantById(variantId) : undefined;
          if (!current || current.sectionType !== op.sectionType) continue;
          next.activeVariants[sectionId] = nextVariant.id;
          applied = true;
        }
        for (const page of next.compositionPlan?.pages ?? []) {
          if (exceptions.has(page.role)) continue;
          if (!page.variants || !(op.sectionType in page.variants)) continue;
          delete page.variants[op.sectionType];
          applied = true;
          planTouched = true;
        }
        if (!applied) {
          throw new Error(`[presentation] this site has no ${op.sectionType} section to restyle.`);
        }
        break;
      }

      case 'setMotionBudget': {
        if (!PRESENTATION_MOTION_BUDGETS.includes(op.motionBudget)) {
          throw new Error(`[presentation] unknown motion budget ${op.motionBudget}.`);
        }
        next.motionBudget = op.motionBudget;
        break;
      }

      case 'setLayoutRecipe': {
        if (!PRESENTATION_LAYOUT_RECIPES.includes(op.layoutRecipe)) {
          throw new Error(`[presentation] unknown layout recipe ${op.layoutRecipe}.`);
        }
        next.layoutRecipe = op.layoutRecipe;
        break;
      }

      case 'setSectionCopy': {
        const page = requirePlanPage(next.compositionPlan, op.pageRole);
        if (!page) throw new Error(`[presentation] this site has no composed page for "${op.pageRole}".`);
        if (!page.sectionOrder.includes(op.sectionType as never)) {
          throw new Error(`[presentation] "${op.sectionType}" is not part of the ${op.pageRole} page.`);
        }
        if (CHROME_SECTIONS.has(op.sectionType)) {
          throw new Error('[presentation] navigation and footer copy is owned by the site shell.');
        }
        const copy = { ...(page.copy ?? {}) };
        const existing = copy[op.sectionType] ?? {};
        copy[op.sectionType] = { ...existing, ...op.copy };
        page.copy = copy;
        planTouched = true;
        break;
      }

      case 'reorderSections': {
        const page = requirePlanPage(next.compositionPlan, op.pageRole);
        if (!page) throw new Error(`[presentation] this site has no composed page for "${op.pageRole}".`);
        const before = [...page.sectionOrder];
        const after = [...op.sectionOrder];
        if (after.length !== before.length || after.some((type) => !before.includes(type as never))) {
          throw new Error('[presentation] a reorder may only rearrange the sections the page already has.');
        }
        if (new Set(after).size !== after.length) {
          throw new Error('[presentation] a reorder may not repeat a section.');
        }
        for (const chrome of CHROME_SECTIONS) {
          if (before.indexOf(chrome as never) !== after.indexOf(chrome as never)) {
            throw new Error('[presentation] navigation and footer position is owned by the site shell.');
          }
        }
        page.sectionOrder = after as typeof page.sectionOrder;
        planTouched = true;
        break;
      }

      case 'removeSection': {
        const page = requirePlanPage(next.compositionPlan, op.pageRole);
        if (!page) throw new Error(`[presentation] this site has no composed page for "${op.pageRole}".`);
        if (CHROME_SECTIONS.has(op.sectionType)) {
          throw new Error('[presentation] navigation and footer cannot be removed from a page.');
        }
        if (!page.sectionOrder.includes(op.sectionType as never)) {
          throw new Error(`[presentation] "${op.sectionType}" is not part of the ${op.pageRole} page.`);
        }
        const remaining = page.sectionOrder.filter((type) => type !== op.sectionType);
        if (remaining.length === 0) {
          throw new Error('[presentation] a page must keep at least one section.');
        }
        page.sectionOrder = remaining as typeof page.sectionOrder;
        if (page.copy) delete page.copy[op.sectionType];
        if (page.variants) delete page.variants[op.sectionType];
        planTouched = true;
        break;
      }

      default: {
        throw new Error(`[presentation] unsupported operation ${(op as { type: string }).type}.`);
      }
    }
  }

  if (planTouched) {
    const revalidated = validateAIPageComposition(
      next.compositionPlan,
      next.artDirectionPackId,
      COMPOSITION_ROLES as unknown as string[],
    );
    if (!revalidated) {
      throw new Error('[presentation] the resulting layout is not a valid certified composition.');
    }
    next.compositionPlan = revalidated;
  }

  return next;
}
