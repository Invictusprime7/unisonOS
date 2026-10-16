/**
 * inspectorPatchExecution — P0.2 of the canonical closure plan.
 *
 * The Property Inspector used to describe its canonical patch plan back to the
 * AI Builder as a prompt ("apply this patch plan exactly..."), which meant a
 * deterministic, already-validated mutation took a non-deterministic detour
 * through a language model.
 *
 * This module turns an `InspectorPatchPlan` into a concrete execution route
 * against the existing canonical rails — no new writer, no new registry:
 *
 *   set-variant      → PresentationOp (snapshot-owned, VFSCommitService)
 *   set-theme-token  → ThemeEdit      (theme lane, VFSCommitService)
 *   set-slot-text    → FileOp on the source that owns the slot
 *   set-slot-asset   → FileOp on the source that owns the slot
 *   set-intent       → BindingOp (canonical Playground binding authority)
 *
 * Source mutations are deterministic attribute/text rewrites scoped to the
 * canonical `data-ut-slot` identity. Anything that cannot be rewritten without
 * guessing is rejected with a reason instead of being handed to the AI.
 */

import type { InspectorPatchOp, InspectorPatchPlan } from './propertyInspectorModel';
import type { BindingOp, FileOp, PresentationOp } from '@/types/patchPlan';
import type { PlaygroundBinding } from '@/platform/core/playground';
import type { ThemeEdit } from '@/services/theme/themeEdit';
import { toCompositionRole } from './semanticPresentationOps';
import { parseResourceProvenance } from '@/services/resources/resourceRuntime';
import type { ResourceEntityRef } from '@/services/resources/resourceTypes';

export type InspectorExecution =
  | { kind: 'presentation'; summary: string; ops: PresentationOp[] }
  | { kind: 'theme'; summary: string; themeEdit: ThemeEdit }
  | { kind: 'binding'; summary: string; bindingOps: BindingOp[] }
  | { kind: 'source'; summary: string; fileOps: FileOp[] }
  /** M2: data-bound text/media saves to its saved record, never the JSX. */
  | { kind: 'resource'; summary: string; ref: ResourceEntityRef; values: Record<string, unknown> }
  | { kind: 'rejected'; reason: string };

export interface InspectorExecutionContext {
  files: Record<string, string>;
  /** Canonical snapshot identity — required for the theme lane. */
  snapshotId?: string | null;
  revisionId?: string | null;
  /**
   * Canonical page role + composed plan for this selection. When present, a
   * copy edit on a composition-owned slot becomes a snapshot-owned
   * `setSectionCopy` operation instead of a JSX rewrite.
   */
  pageRole?: string | null;
  composedSections?: readonly string[] | null;
  /** Snapshot-owned bindings keyed by binding id. Intent edits require one. */
  bindings?: Record<string, PlaygroundBinding> | null;
  /** `data-ut-resource` mark of the selected element (resourceKey#id.field). */
  resourceMark?: string | null;
}

/** Copy slots the composition plan owns directly. */
const COMPOSITION_COPY_SLOTS: Record<string, 'headline' | 'subheadline' | 'description'> = {
  headline: 'headline',
  title: 'headline',
  subheadline: 'subheadline',
  subtitle: 'subheadline',
  description: 'description',
  body: 'description',
};

const SOURCE_FILE_RE = /\.(tsx|jsx)$/;

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Locate the opening JSX tag that carries `data-ut-slot="<slotId>"`. */
function findSlotTag(
  files: Record<string, string>,
  sectionId: string | null,
  slotId: string,
): { path: string; content: string; start: number; end: number } | null {
  const attr = new RegExp(`data-ut-slot=["']${escapeRe(slotId)}["']`);
  const candidates = Object.entries(files).filter(
    ([path, content]) => SOURCE_FILE_RE.test(path) && typeof content === 'string' && attr.test(content),
  );
  const scopedCandidates = sectionId
    ? candidates.filter(([, content]) => new RegExp(`data-ut-section-id=["']${escapeRe(sectionId)}["']`).test(content))
    : candidates;
  if (scopedCandidates.length !== 1) return null;

  const [path, content] = scopedCandidates[0];
  const matches = [...content.matchAll(new RegExp(attr.source, 'g'))];
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match) return null;

  let start = match.index;
  while (start > 0 && content[start] !== '<') start -= 1;
  let end = match.index;
  while (end < content.length && content[end] !== '>') end += 1;
  if (content[start] !== '<' || content[end] !== '>') return null;
  return { path, content, start, end };
}

function setAttribute(tag: string, name: string, value: string): string {
  const existing = new RegExp(`\\s${escapeRe(name)}=["'][^"']*["']`);
  if (existing.test(tag)) return tag.replace(existing, ` ${name}="${value}"`);
  return tag.replace(/\s*(\/?>)$/, ` ${name}="${value}"$1`);
}

function safeAttrValue(value: string): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (/["'<>{}\n]/.test(trimmed)) return null;
  return trimmed;
}

function replaceFileRange(content: string, start: number, end: number, next: string): string {
  return content.slice(0, start) + next + content.slice(end);
}

export function planInspectorExecution(
  plan: Extract<InspectorPatchPlan, { ok: true }>,
  context: InspectorExecutionContext,
): InspectorExecution {
  const op: InspectorPatchOp = plan.op;

  // M2: a selection marked as a saved-record field edits that record directly.
  if (op.type === 'set-slot-text' || op.type === 'set-slot-asset') {
    const ref = parseResourceProvenance(context.resourceMark);
    if (ref) {
      const value = String(op.value ?? '');
      if (!value.trim()) return { kind: 'rejected', reason: 'Enter a value before applying this change.' };
      const field = ref.field ?? (op.type === 'set-slot-asset' ? 'image' : 'name');
      return { kind: 'resource', summary: plan.description, ref: { ...ref, field }, values: { [field]: value } };
    }
  }

  if (op.type === 'set-variant') {
    if (!op.sectionId || !op.variantId) {
      return { kind: 'rejected', reason: 'This selection has no canonical section identity to restyle.' };
    }
    return {
      kind: 'presentation',
      summary: plan.description,
      ops: [{ type: 'setVariant', sectionId: op.sectionId, variantId: op.variantId }],
    };
  }

  if (op.type === 'set-theme-token') {
    if (!op.token || typeof op.value !== 'string') {
      return { kind: 'rejected', reason: 'This style change has no theme token to write.' };
    }
    if (!context.snapshotId) {
      return { kind: 'rejected', reason: 'Save or open a site before changing its theme tokens.' };
    }
    return {
      kind: 'theme',
      summary: plan.description,
      themeEdit: {
        version: '1.0',
        snapshotId: context.snapshotId,
        revisionId: context.revisionId ?? null,
        set: { [op.token]: op.value },
        reset: [],
      },
    };
  }

  if (!op.slotId) {
    return { kind: 'rejected', reason: 'This selection is not bound to a canonical slot.' };
  }

  if (op.type === 'set-slot-text') {
    const text = String(op.value ?? '');
    if (!text.trim()) return { kind: 'rejected', reason: 'Enter some text before applying this change.' };
    if (/[<>{}]/.test(text)) {
      return { kind: 'rejected', reason: 'Text cannot contain code or markup characters.' };
    }

    const copySlot = op.slotId.split('.').pop() ?? op.slotId;
    const copyField = COMPOSITION_COPY_SLOTS[op.slotId] ?? COMPOSITION_COPY_SLOTS[copySlot];
    const compositionRole = toCompositionRole(context.pageRole);
    const sectionType = op.sectionType ?? null;
    if (copyField && compositionRole && sectionType && context.composedSections?.includes(sectionType)) {
      return {
        kind: 'presentation',
        summary: plan.description,
        ops: [{
          type: 'setSectionCopy',
          pageRole: compositionRole,
          sectionType,
          copy: { [copyField]: text },
        }],
      };
    }
  }

  const target = findSlotTag(context.files, op.sectionId, op.slotId);
  if (!target) {
    return {
      kind: 'rejected',
      reason: `Slot "${op.slotId}" could not be uniquely matched to the selected section in the page source. Refresh the preview and reselect the text.`,
    };
  }

  const tag = target.content.slice(target.start, target.end + 1);

  if (op.type === 'set-intent') {
    const intent = safeAttrValue(op.intent ?? '');
    if (!intent) return { kind: 'rejected', reason: 'That action name cannot be written safely.' };
    const bindings = Object.values(context.bindings ?? {}).filter((candidate) => candidate.sourceSlot === op.slotId);
    if (bindings.length !== 1) {
      return {
        kind: 'rejected',
        reason: bindings.length === 0
          ? `Slot "${op.slotId}" has no canonical binding record. Refresh the project before rewiring it.`
          : `Slot "${op.slotId}" maps to multiple bindings. Select the rendered control before rewiring it.`,
      };
    }
    const binding = bindings[0];
    return {
      kind: 'binding',
      summary: plan.description,
      bindingOps: [{ type: 'bindIntent', elementId: binding.bindingId, intent }],
    };
  }

  if (op.type === 'set-slot-asset') {
    const url = safeAttrValue(op.value ?? '');
    if (!url) return { kind: 'rejected', reason: 'That image address cannot be written safely.' };
    if (!/^<img\b/i.test(tag) && !/\bsrc=/.test(tag)) {
      return {
        kind: 'rejected',
        reason: `Slot "${op.slotId}" renders media from its design recipe. Change it from the media panel.`,
      };
    }
    let nextTag = setAttribute(tag, 'src', url);
    const alt = op.alt ? safeAttrValue(op.alt) : null;
    if (alt) nextTag = setAttribute(nextTag, 'alt', alt);
    return {
      kind: 'source',
      summary: plan.description,
      fileOps: [{
        type: 'replace',
        path: target.path,
        contents: replaceFileRange(target.content, target.start, target.end + 1, nextTag),
      }],
    };
  }

  // Non-composition slot text can only be edited when the source owns a literal.
  const text = String(op.value ?? '');
  if (!text.trim()) return { kind: 'rejected', reason: 'Enter some text before applying this change.' };
  if (/[<>{}]/.test(text)) {
    return { kind: 'rejected', reason: 'Text cannot contain code or markup characters.' };
  }

  const after = target.content.slice(target.end + 1);
  const literal = /^([^<>{}]*)</.exec(after);
  if (!literal) {
    return {
      kind: 'rejected',
      reason: `Slot "${op.slotId}" renders text from data that is not linked to a saved item, so it cannot be edited here. Ask the AI Builder to link or rewrite it.`,
    };
  }
  const textStart = target.end + 1;
  const textEnd = textStart + literal[1].length;
  return {
    kind: 'source',
    summary: plan.description,
    fileOps: [{
      type: 'replace',
      path: target.path,
      contents: replaceFileRange(target.content, textStart, textEnd, text),
    }],
  };
}
