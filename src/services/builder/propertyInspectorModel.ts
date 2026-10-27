/**
 * propertyInspectorModel — M9 visual selection / property inspector.
 *
 * Pure projection layer between a preview selection (DOM identity emitted by
 * the Sandpack selection bridge) and the canonical registries:
 *
 *   - `resolvedImplementationContract` (M6) → artifact, slots, intents, catalog
 *   - Variant Registry                      → certified variant alternatives
 *   - `componentStates`                     → real interaction/responsive states
 *   - Theme Contract                        → the only mutable style surface
 *
 * Two hard rules:
 *   1. The inspector never invents identity. Everything it shows is derived
 *      from `data-ut-*` identity already compiled into the page.
 *   2. Every mutation leaves through `buildInspectorPatchPlan`, which produces
 *      a canonical patch plan or an explicit rejection — never a raw CSS blob.
 */

import type { SectionType } from '@/sections/types';
import type { VariantId } from '@/sections/variants/types';
import { getGenerationVariantsForSection, getVariantById } from '@/sections/variants/registry';
import {
  resolveComponentStateContract,
  type ComponentStateContract,
} from '@/sections/variants/componentStates';
import {
  resolveImplementationContract,
  type ResolvedImplementationContract,
  type ResolvedImplementationSlot,
} from '@/platform/core/resolvedImplementationContract';
import { allThemeContractTokenNames } from '@/platform/core/themeContract';

// ─────────────────────────────────────────────────────────────────────────────
// Selection input — mirrors the preview bridge payload (all fields optional)
// ─────────────────────────────────────────────────────────────────────────────

export interface InspectorScopeAncestors {
  elementId?: string | null;
  slotId?: string | null;
  blockId?: string | null;
  sectionId?: string | null;
  sectionType?: string | null;
  surfaceId?: string | null;
  componentType?: string | null;
  pageId?: string | null;
  pagePath?: string | null;
  intents?: string[];
  primaryIntent?: string | null;
  clickedTag?: string;
}

export interface InspectorSelection {
  tagName?: string;
  textContent?: string;
  selector?: string;
  attributes?: Record<string, string>;
  scopeAncestors?: InspectorScopeAncestors | null;
  imageTarget?: { kind: 'img' | 'background'; selector: string; src?: string } | null;
  /** Canonical section identities from the selected page's resolved composition. */
  canonicalSections?: readonly { sectionId: string; sectionType: string; variantId?: string }[];
}

export function resolveInspectorCanonicalSections(
  pageSections: readonly { sectionId: string; sectionType: string; variantId?: string }[] | undefined,
  activeVariants?: Record<string, string> | null,
): readonly { sectionId: string; sectionType: string; variantId?: string }[] {
  if (pageSections) return pageSections;
  return Object.entries(activeVariants ?? {}).flatMap(([sectionId, variantId]) => {
    const variant = getVariantById(variantId as VariantId);
    return variant ? [{ sectionId, sectionType: variant.sectionType, variantId }] : [];
  });
}

export type InspectorScope = 'section' | 'slot' | 'element';

export interface InspectorVariantOption {
  id: VariantId;
  name: string;
  description: string;
  generationStatus: 'preferred' | 'supported' | 'legacy' | 'retired';
  /** True when the implementation carries certified 21st-derived provenance. */
  certified: boolean;
  current: boolean;
}

export interface InspectorModel {
  scope: InspectorScope;
  sectionId: string | null;
  sectionType: SectionType | null;
  variantId: VariantId | null;
  pagePath: string | null;

  contract: ResolvedImplementationContract | null;
  states: ComponentStateContract | null;

  slots: readonly ResolvedImplementationSlot[];
  activeSlot: ResolvedImplementationSlot | null;
  variants: readonly InspectorVariantOption[];
  intents: readonly string[];
  activeIntent: string | null;
  catalogSurfaceId: string | null;
  dataSource: 'catalog' | 'static';

  /** Canonical CSS custom properties the inspector may write. */
  editableTokens: readonly string[];
  /** Canonical selector the patch plan targets. */
  targetSelector: string | null;
  /** Human-readable reasons a control is unavailable. */
  warnings: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Selector derivation — section- and slot-scoped, matching the runtime bridge
// ─────────────────────────────────────────────────────────────────────────────

function escapeAttr(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function sectionSelector(sectionId: string): string {
  return `[data-ut-section-id="${escapeAttr(sectionId)}"]`;
}

export function slotSelector(sectionId: string | null, slotId: string): string {
  const slot = `[data-ut-slot="${escapeAttr(slotId)}"]`;
  return sectionId ? `${sectionSelector(sectionId)} ${slot}` : slot;
}

/** Preview slot namespaces carry their section family when the DOM has no section wrapper. */
export function resolveSlotSectionType(sectionType: string | null | undefined, slotId: string | null | undefined): SectionType | null {
  if (sectionType) return sectionType as SectionType;
  const prefix = slotId?.split('.')[0]?.trim();
  return prefix ? prefix as SectionType : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model resolution
// ─────────────────────────────────────────────────────────────────────────────

function readVariantId(selection: InspectorSelection): VariantId | null {
  const attr = selection.attributes?.['data-ut-variant'];
  return attr && attr.includes(':') ? (attr as VariantId) : null;
}

function isCertified(variantId: VariantId): boolean {
  const variant = getVariantById(variantId);
  const source = variant?.source as { registry?: string; certification?: string } | undefined;
  if (!source) return false;
  return Boolean(source.registry && String(source.registry).includes('21st'));
}

/**
 * Resolve everything the inspector can show for a selection. Never throws:
 * an unrecognised selection degrades to an `element` scope with no contract,
 * which the UI renders as "no canonical controls for this element".
 */
export function resolveInspectorModel(selection: InspectorSelection | null | undefined): InspectorModel {
  const warnings: string[] = [];
  const ancestors = selection?.scopeAncestors ?? {};
  const variantId = readVariantId(selection ?? {});
  const sectionType = resolveSlotSectionType(
    ancestors.sectionType ?? (variantId ? getVariantById(variantId)?.sectionType : null),
    ancestors.slotId ?? selection?.attributes?.['data-ut-slot'],
  );
  const familyMatches = (selection?.canonicalSections ?? []).filter((section) =>
    !sectionType || section.sectionType === sectionType,
  );
  const variantMatches = variantId
    ? familyMatches.filter((section) => section.variantId === variantId)
    : familyMatches;
  const canonicalMatches = variantMatches.length > 0 ? variantMatches : familyMatches;
  const sectionId = ancestors.sectionId
    ?? (canonicalMatches.length === 1 ? canonicalMatches[0].sectionId : null);
  const slotIdRaw = ancestors.slotId ?? selection?.attributes?.['data-ut-slot'] ?? null;

  const contract = variantId
    ? resolveImplementationContract(variantId)
    : sectionType
      ? resolveImplementationContract(`${sectionType}:generic`)
      : null;

  if (variantId && !contract) {
    warnings.push(`Variant "${variantId}" is not in the certified registry — variant controls are disabled.`);
  }
  if (!sectionId) {
    warnings.push(canonicalMatches.length > 1
      ? 'This element matches multiple canonical sections, so edits cannot be scoped safely.'
      : 'This element has no canonical section identity, so edits cannot be scoped.');
  }

  const resolvedSectionType = (contract?.sectionType ?? sectionType) as SectionType | null;

  const variants: InspectorVariantOption[] = resolvedSectionType
    ? getGenerationVariantsForSection(resolvedSectionType).map((variant) => ({
        id: variant.id,
        name: variant.name,
        description: variant.description,
        generationStatus: variant.generationStatus ?? 'preferred',
        certified: isCertified(variant.id),
        current: variant.id === variantId,
      }))
    : [];

  const states =
    resolvedSectionType != null
      ? resolveComponentStateContract({
          sectionType: resolvedSectionType,
          states: variantId ? getVariantById(variantId)?.states : undefined,
        })
      : null;

  const slots = contract?.slots ?? [];
  const activeSlot = slotIdRaw ? slots.find((slot) => slot.id === slotIdRaw) ?? null : null;
  if (slotIdRaw && !activeSlot) {
    warnings.push(`Slot "${slotIdRaw}" is not declared by this design's artifact contract.`);
  }

  const scope: InspectorScope = activeSlot ? 'slot' : sectionId && !slotIdRaw ? 'section' : 'element';

  const targetSelector = activeSlot
    ? slotSelector(sectionId, activeSlot.id)
    : sectionId
      ? sectionSelector(sectionId)
      : selection?.selector ?? null;

  return {
    scope,
    sectionId,
    sectionType: resolvedSectionType,
    variantId,
    pagePath: ancestors.pagePath ?? null,
    contract,
    states,
    slots,
    activeSlot,
    variants,
    intents: contract?.intents ?? [],
    activeIntent: ancestors.primaryIntent ?? null,
    catalogSurfaceId: contract?.catalogSurfaceId ?? null,
    dataSource: contract?.catalogSurfaceId ? 'catalog' : 'static',
    editableTokens: allThemeContractTokenNames(),
    targetSelector,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations → canonical patch plans
// ─────────────────────────────────────────────────────────────────────────────

export type InspectorMutation =
  | { kind: 'variant'; variantId: VariantId }
  | { kind: 'slot-text'; slotId: string; value: string }
  | { kind: 'slot-asset'; slotId: string; assetUrl: string; alt?: string }
  | { kind: 'token'; token: string; value: string }
  | { kind: 'intent'; intent: string };

export interface InspectorPatchOp {
  type: 'set-variant' | 'set-slot-text' | 'set-slot-asset' | 'set-theme-token' | 'set-intent';
  sectionId: string | null;
  /** Canonical section family (copy edits project onto the composition plan). */
  sectionType?: SectionType | null;
  selector: string;
  slotId?: string;
  variantId?: VariantId;
  token?: string;
  value?: string;
  alt?: string;
  intent?: string;
}

export type InspectorPatchPlan =
  | { ok: true; op: InspectorPatchOp; description: string; pagePath: string | null }
  | { ok: false; reason: string };

/**
 * Translate an inspector mutation into a canonical patch plan.
 * Rejects anything that would break canonical identity: unknown or locked
 * slots, uncertified variants, undocumented theme tokens and intents the
 * artifact does not bind.
 */
export function buildInspectorPatchPlan(
  model: InspectorModel,
  mutation: InspectorMutation,
): InspectorPatchPlan {
  switch (mutation.kind) {
    case 'variant': {
      if (!model.sectionId) return { ok: false, reason: 'No canonical section identity for this selection.' };
      const option = model.variants.find((candidate) => candidate.id === mutation.variantId);
      if (!option) {
        return {
          ok: false,
          reason: `"${mutation.variantId}" is not a generation-eligible design for this section.`,
        };
      }
      return {
        ok: true,
        pagePath: model.pagePath,
        description: `Switch ${model.sectionType ?? 'section'} to ${option.name}`,
        op: {
          type: 'set-variant',
          sectionId: model.sectionId,
          selector: sectionSelector(model.sectionId),
          variantId: option.id,
        },
      };
    }

    case 'slot-text':
    case 'slot-asset': {
      const slot = model.slots.find((candidate) => candidate.id === mutation.slotId);
      if (!slot) return { ok: false, reason: `Slot "${mutation.slotId}" is not part of this design's contract.` };
      if (!slot.editable) return { ok: false, reason: `Slot "${slot.id}" is locked by its artifact contract.` };
      if (mutation.kind === 'slot-asset' && slot.kind !== 'asset') {
        return { ok: false, reason: `Slot "${slot.id}" holds ${slot.kind} content, not media.` };
      }
      if (mutation.kind === 'slot-text' && slot.kind === 'asset') {
        return { ok: false, reason: `Slot "${slot.id}" holds media, not text.` };
      }
      const selector = slotSelector(model.sectionId, slot.id);
      return mutation.kind === 'slot-text'
        ? {
            ok: true,
            pagePath: model.pagePath,
            description: `Update ${slot.id}`,
            op: {
              type: 'set-slot-text',
              sectionId: model.sectionId,
              sectionType: model.sectionType,
              selector,
              slotId: slot.id,
              value: mutation.value,
            },
          }
        : {
            ok: true,
            pagePath: model.pagePath,
            description: `Replace media in ${slot.id}`,
            op: {
              type: 'set-slot-asset',
              sectionId: model.sectionId,
              selector,
              slotId: slot.id,
              value: mutation.assetUrl,
              alt: mutation.alt,
            },
          };
    }

    case 'token': {
      if (!model.editableTokens.includes(mutation.token)) {
        return {
          ok: false,
          reason: `"${mutation.token}" is not a documented theme token — styling must stay on the theme contract.`,
        };
      }
      return {
        ok: true,
        pagePath: model.pagePath,
        description: `Set ${mutation.token}`,
        op: {
          type: 'set-theme-token',
          sectionId: model.sectionId,
          selector: ':root',
          token: mutation.token,
          value: mutation.value,
        },
      };
    }

    case 'intent': {
      if (!model.intents.includes(mutation.intent)) {
        return { ok: false, reason: `Intent "${mutation.intent}" is not bound by this section's artifact.` };
      }
      if (!model.targetSelector) return { ok: false, reason: 'No canonical target for this selection.' };
      return {
        ok: true,
        pagePath: model.pagePath,
        description: `Bind ${mutation.intent}`,
        op: {
          type: 'set-intent',
          sectionId: model.sectionId,
          selector: model.targetSelector,
          intent: mutation.intent,
        },
      };
    }
  }
}

/**
 * Contextual AI instruction for the in-Builder assistant, grounded in the
 * canonical identity of the current selection (M9 "contextual AI edits").
 */
export function buildContextualAIPrompt(model: InspectorModel, request: string): string {
  const lines = [request.trim(), '', 'Canonical selection context (do not change these identities):'];
  if (model.sectionId) lines.push(`- data-ut-section-id: ${model.sectionId}`);
  if (model.sectionType) lines.push(`- section type: ${model.sectionType}`);
  if (model.variantId) lines.push(`- data-ut-variant: ${model.variantId}`);
  if (model.activeSlot) lines.push(`- data-ut-slot: ${model.activeSlot.id} (${model.activeSlot.kind})`);
  if (model.intents.length) lines.push(`- allowed intents: ${model.intents.join(', ')}`);
  if (model.states) {
    lines.push(`- supported states: ${model.states.supported.join(', ')}`);
    lines.push(`- reduced motion: ${model.states.interaction.reducedMotion}`);
  }
  lines.push('- style only through documented theme tokens; never hardcode colors.');
  return lines.join('\n');
}
