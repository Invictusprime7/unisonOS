/**
 * Canonical binding-operation executor.
 *
 * Intent bindings belong to PlaygroundState, not to an arbitrary JSX edit.
 * This module resolves the preview's stable binding identity and produces the
 * next immutable PlaygroundState for VFSCommitService to compile and persist.
 */

import { resolveIntentName } from '@/platform/core/intentSurfaceRegistry';
import type { PlaygroundBinding, PlaygroundState } from '@/platform/core/playground';
import type { BindingOp } from '@/types/patchPlan';

export interface BindingOperationResult {
  playground: PlaygroundState;
  /** Bindings whose attributes must be projected into the accepted VFS. */
  boundBindingIds: string[];
  /** Removed bindings whose old attributes must be stripped from the VFS. */
  unboundBindings: PlaygroundBinding[];
}

function bindingMatches(binding: PlaygroundBinding, elementId: string): boolean {
  return binding.bindingId === elementId
    || binding.elementKey === elementId
    || `${binding.sourcePageId}:${binding.sourceSection ?? ''}:${binding.sourceSlot ?? ''}` === elementId;
}

function resolveBinding(bindings: Record<string, PlaygroundBinding>, elementId: string): PlaygroundBinding {
  const exact = Object.values(bindings).filter((binding) => bindingMatches(binding, elementId));
  // `sourceSlot` is supported for older inspector payloads only when it is
  // unambiguous. New preview selections carry bindingId or bindingKey.
  const matches = exact.length > 0
    ? exact
    : Object.values(bindings).filter((binding) => binding.sourceSlot === elementId);
  if (matches.length === 0) {
    throw new Error(`[BindingOperation] No canonical binding matches "${elementId}".`);
  }
  if (matches.length > 1) {
    throw new Error(`[BindingOperation] Binding target "${elementId}" is ambiguous. Select a specific rendered control.`);
  }
  return matches[0];
}

const COMPATIBLE_CORE_INTENTS: Record<PlaygroundBinding['intent'], readonly string[]> = {
  'nav.goto_page': ['nav.goto', 'nav.anchor'],
  'funnel.goto_step': ['nav.goto'],
  'form.open': ['contact.submit', 'quote.request', 'lead.capture', 'newsletter.subscribe'],
  'popup.open': ['auth.register', 'auth.login', 'nav.anchor'],
  'calendar.open': ['booking.create'],
  'checkout.start': ['cart.add', 'cart.checkout', 'pay.checkout', 'donation.start'],
  'product.view': ['product.view'],
  'cart.view': ['cart.view'],
  'account.open': ['account.open', 'auth.login', 'auth.register'],
  'menu.open': ['menu.open', 'nav.goto', 'nav.anchor'],
  'search.open': ['search.open'],
  'filter.open': ['filter.open'],
  'sort.open': ['sort.open'],
  'favorite.toggle': ['favorite.toggle'],
  'share.open': ['share.open'],
  'chat.open': ['chat.open'],
  'external.open': ['nav.external'],
};

function assertIntentTargetCompatibility(binding: PlaygroundBinding, intent: string): void {
  const canonicalBindingIntent = binding.coreIntent ? resolveIntentName(binding.coreIntent) : null;
  const compatible = new Set([
    ...(COMPATIBLE_CORE_INTENTS[binding.intent] ?? []),
    ...(canonicalBindingIntent ? [canonicalBindingIntent] : []),
  ]);
  if (!compatible.has(intent)) {
    throw new Error(
      `[BindingOperation] Intent "${intent}" is incompatible with the selected ${binding.targetType} target. ` +
      `Create or select a compatible target before changing this behavior.`,
    );
  }
}

/** Apply typed binding operations without writing VFS or persistence directly. */
export function applyBindingOperations(
  playground: PlaygroundState | undefined,
  operations: readonly BindingOp[],
): BindingOperationResult {
  if (!operations.length) {
    if (!playground) throw new Error('[BindingOperation] A canonical PlaygroundState is required.');
    return { playground, boundBindingIds: [], unboundBindings: [] };
  }
  if (!playground?.bindings) {
    throw new Error('[BindingOperation] Intent changes require a canonical PlaygroundState. Reload the project and try again.');
  }

  const bindings = { ...playground.bindings };
  const boundBindingIds: string[] = [];
  const unboundBindings: PlaygroundBinding[] = [];
  for (const operation of operations) {
    const binding = resolveBinding(bindings, operation.elementId);
    if (operation.type === 'unbindIntent') {
      delete bindings[binding.bindingId];
      unboundBindings.push(binding);
      continue;
    }
    const intent = resolveIntentName(operation.intent ?? '');
    if (!intent) {
      throw new Error(`[BindingOperation] "${operation.intent ?? ''}" is not a registered intent.`);
    }
    assertIntentTargetCompatibility(binding, intent);
    bindings[binding.bindingId] = {
      ...binding,
      coreIntent: intent,
      payloadTemplate: { ...(binding.payloadTemplate ?? {}), ...(operation.payload ?? {}) },
      source: 'ai',
      isValid: true,
      validationMessage: undefined,
    };
    boundBindingIds.push(binding.bindingId);
  }

  return {
    playground: { ...playground, bindings },
    boundBindingIds,
    unboundBindings,
  };
}

/** Remove only attributes belonging to a removed canonical binding. */
export function stripUnboundBindingAttributes(
  files: Record<string, string>,
  bindings: readonly PlaygroundBinding[],
): Record<string, string> {
  if (!bindings.length) return files;
  const ids = new Set(bindings.map((binding) => binding.bindingId));
  const bindingIdPattern = [...ids]
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!bindingIdPattern) return files;
  const tagPattern = new RegExp(`<[^<>]*\\sdata-ut-binding-id=(['"])(?:${bindingIdPattern})\\1[^<>]*>`, 'g');
  const ownedAttribute = /\sdata-(?:ut-)?(?:intent|slot|section-role|slot-id|label|ui-action|binding-id|binding-key|path|target-page-id|target-id|target-type|url)=(['"]).*?\1/g;
  return Object.fromEntries(Object.entries(files).map(([path, contents]) => [
    path,
    contents.replace(tagPattern, (tag) => tag.replace(ownedAttribute, '')),
  ]));
}
