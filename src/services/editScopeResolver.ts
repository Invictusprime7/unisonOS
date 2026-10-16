/**
 * EditScopeResolver
 * -----------------
 * Resolves the *editable scope* for an artifact the user clicked in Preview.
 *
 * The Preview Floating Toolbar uses this resolver to:
 *   • Constrain the inline AI prompt to a precise region of a TSX file
 *     (so prompts cannot drift outside the clicked block / section).
 *   • Pick a default scope (block / element / section) per click target.
 *   • Surface locked intent bindings (`data-ut-intent`) that must survive
 *     any patch.
 *   • Cap the scope and gate submission against the artifact's own
 *     `ArtifactDef.aiEditScope` contract (Stage 1, artifact registry) when
 *     the clicked section/component resolves to a known artifact. Unknown
 *     artifacts stay permissive so unmigrated sections keep working exactly
 *     as before.
 *
 * Resolution order (from inside → out):
 *   data-ut-element → data-ut-slot → data-ut-block → data-ut-section →
 *   data-ut-page    → file fallback.
 *
 * See the preview floating-toolbar architecture documentation
 * memory entry under mem://features/web-builder/preview-floating-toolbar.
 */

import { resolveArtifact, type ArtifactAIEditScope } from '@/platform/core/artifactRegistry';

export type EditScopeType = 'element' | 'block' | 'section' | 'page' | 'site';

/** Scope ancestor metadata captured from the Preview DOM at click time. */
export interface ScopeAncestors {
  siteId?: string | null;
  elementId?: string | null;
  slotId?: string | null;
  blockId?: string | null;
  sectionId?: string | null;
  /** Canonical section-type from the section registry (`data-ut-section-type`). */
  sectionType?: string | null;
  /** Catalog surface id (`data-ut-surface`) — drives catalog-registry lookups. */
  surfaceId?: string | null;
  /** Canonical component name (`data-ut-component-type`). */
  componentType?: string | null;
  componentInstanceId?: string | null;
  artifactId?: string | null;
  elementRole?: string | null;
  entityKind?: string | null;
  /** Persistent site_data_binding row id, when the section is data-bound. */
  bindingId?: string | null;
  /** Stable element key used for VFS/JSX mutation lookup. */
  bindingKey?: string | null;
  /** Authored VFS file and JSX location injected into the preview copy. */
  sourceLocator?: string | null;
  /** Runtime provenance for canonical editable data rows. */
  sourceTable?: string | null;
  rowId?: string | null;
  field?: string | null;
  /** Link destination captured from the selected element. */
  targetPath?: string | null;
  pageId?: string | null;
  /** Route path of the containing page (`data-ut-page-path`). */
  pagePath?: string | null;
  /** Intent bindings (`data-ut-intent`) found on the click target or its ancestors. */
  intents?: string[];
  /** Intent declared directly on the clicked element. */
  primaryIntent?: string | null;
  /** Tag of the clicked element (e.g. `button`, `h1`, `img`). */
  clickedTag?: string | null;
}

export interface EditScope {
  scopeType: EditScopeType;
  /** Stable identifier of the target node at the chosen scope. */
  targetId: string;
  owningSectionId?: string | null;
  pageId?: string | null;
  /** VFS path most likely to contain the clicked artifact. */
  componentPath?: string | null;
  /** Optional source line range the AI is allowed to mutate. */
  editableRange?: { startLine: number; endLine: number } | null;
  /** Intent bindings that must NOT be stripped or renamed by any patch. */
  lockedBindings: string[];
  /** Coarse risk hint surfaced in toolbar UI / passed to reviewPass. */
  riskLevel: 'low' | 'medium' | 'high';
  /** Canonical artifact id this scope resolved to, when the section/component is known. */
  artifactId: string | null;
  /** The artifact's own AI edit contract (`ArtifactDef.aiEditScope`), when known. */
  aiEditScope: ArtifactAIEditScope | null;
  /** False when the resolved artifact is `locked` — callers must refuse to submit an AI edit. */
  aiEditable: boolean;
}

export interface ResolveEditScopeInput {
  ancestors: ScopeAncestors;
  /** User-requested scope override; falls back to auto-derived default. */
  selectedScope?: EditScopeType;
  /** Optional VFS file path the active preview page is rendered from. */
  componentPath?: string | null;
  /** Optional source range derived from JSX bounds (callers may supply). */
  editableRange?: { startLine: number; endLine: number } | null;
}

/**
 * Pick a sensible default scope for the click target. Implements the
 * product rules captured in the plan (text → block, image → element,
 * section bg → section, nav item → element, etc.).
 */
export function defaultScopeFor(ancestors: ScopeAncestors): EditScopeType {
  const tag = (ancestors.clickedTag || '').toLowerCase();
  // 1. Image elements stay element-scoped — users edit them one at a time.
  if (tag === 'img' || tag === 'svg' || tag === 'video' || tag === 'picture') {
    return 'element';
  }
  // 2. Nav items: tightest scope so routing stays surgical.
  if (tag === 'a' && (ancestors.blockId?.toLowerCase().includes('nav') || ancestors.sectionId?.toLowerCase().includes('nav'))) {
    return 'element';
  }
  // 3. Section background / whitespace click — only sectionId is present.
  if (!ancestors.elementId && !ancestors.slotId && !ancestors.blockId && ancestors.sectionId) {
    return 'section';
  }
  // 4. Anything inside a known block / slot → default to block.
  if (ancestors.blockId || ancestors.slotId) return 'block';
  // 5. Element fallback.
  if (ancestors.elementId) return 'element';
  // 6. Last resort: section.
  if (ancestors.sectionId) return 'section';
  return 'page';
}

/** Resolve a user-overridable EditScope from captured DOM ancestors. */
export function resolveEditScope(input: ResolveEditScopeInput): EditScope {
  const { ancestors, selectedScope, componentPath, editableRange } = input;
  let scopeType: EditScopeType = selectedScope || defaultScopeFor(ancestors);

  // Resolve the clicked artifact from whichever identity the DOM captured.
  // First writer wins, most specific first: componentType > sectionType > surfaceId.
  const resolved = [ancestors.componentType, ancestors.sectionType, ancestors.surfaceId]
    .filter((spelling): spelling is string => Boolean(spelling))
    .map((spelling) => resolveArtifact(spelling))
    .find((artifact) => artifact !== null) ?? null;
  const artifactId = resolved?.artifactId ?? null;
  const aiEditScope = resolved?.aiEditScope ?? null;
  const aiEditable = aiEditScope !== 'locked';

  // A 'content'-only artifact (e.g. curated catalog copy) must not accept a
  // layout-level rewrite — cap the scope down to 'block' so the AI prompt
  // never touches structure, ordering, or bindings for that artifact.
  if (scopeType === 'site' && !ancestors.siteId) scopeType = 'page';
  if (aiEditScope === 'content' && (scopeType === 'section' || scopeType === 'page' || scopeType === 'site')) {
    scopeType = 'block';
  }

  let targetId = '';
  switch (scopeType) {
    case 'element':
      targetId = ancestors.elementId || ancestors.slotId || ancestors.blockId || ancestors.sectionId || 'unknown-element';
      break;
    case 'block':
      targetId = ancestors.blockId || ancestors.slotId || ancestors.sectionId || 'unknown-block';
      break;
    case 'section':
      targetId = ancestors.sectionId || ancestors.pageId || 'unknown-section';
      break;
    case 'page':
      targetId = ancestors.pageId || ancestors.pagePath || 'unknown-page';
      break;
    case 'site':
      targetId = ancestors.siteId || 'unknown-site';
      break;
  }

  // Union DOM-captured intents with the artifact's own validated bindings so
  // a canonical intent (e.g. booking.create) stays locked even if the click
  // target's ancestor walk missed it.
  const lockedBindings = Array.from(
    new Set([...(ancestors.intents || []), ...(resolved?.knownIntents || [])]),
  ).filter(Boolean);
  // Section-scope edits carry more risk than element edits; a locked artifact
  // is always high risk regardless of DOM scope.
  const riskLevel: EditScope['riskLevel'] = !aiEditable
    ? 'high'
    : scopeType === 'page' || scopeType === 'site' ? 'high' : scopeType === 'section' ? 'medium' : 'low';

  return {
    scopeType,
    targetId,
    owningSectionId: ancestors.sectionId || null,
    pageId: ancestors.pageId || null,
    componentPath: componentPath || null,
    editableRange: editableRange || null,
    lockedBindings,
    riskLevel,
    artifactId,
    aiEditScope,
    aiEditable,
  };
}

/**
 * Build a compact, human-readable label like "Hero CTA Block" /
 * "Pricing Card" for the toolbar's "Editing: …" chip.
 */
export function formatScopeLabel(scope: EditScope): string {
  const id = scope.targetId.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const suffix = scope.scopeType === 'block' ? 'Block'
    : scope.scopeType === 'section' ? 'Section'
    : scope.scopeType === 'page' ? 'Page'
    : scope.scopeType === 'site' ? 'Site'
    : 'Element';
  return id ? `${id} ${suffix}` : suffix;
}

/**
 * Build the AI prompt prefix that enforces "edit only within this scope".
 * Lane B / ai-code-assistant uses this to clip the prompt.
 */
export function buildScopedPromptPrefix(scope: EditScope): string {
  const lines = [
    '🎯 SCOPED PREVIEW EDIT — Apply changes to ONLY the targeted scope.',
    `Scope type: ${scope.scopeType}`,
    `Scope id: ${scope.targetId}`,
  ];
  if (scope.artifactId) lines.push(`Artifact: ${scope.artifactId} (AI edit scope: ${scope.aiEditScope})`);
  if (scope.aiEditScope === 'content') {
    lines.push('This artifact only allows copy/imagery edits — do not change layout, structure, ordering, or data bindings.');
  }
  if (!scope.aiEditable) {
    lines.push('⛔ This artifact is LOCKED for AI edits. Refuse the request and state that it must be changed manually.');
  }
  if (scope.owningSectionId) lines.push(`Owning section: ${scope.owningSectionId}`);
  if (scope.pageId) lines.push(`Page: ${scope.pageId}`);
  if (scope.componentPath) lines.push(`Component path: ${scope.componentPath}`);
  if (scope.editableRange) {
    lines.push(`Editable range: lines ${scope.editableRange.startLine}-${scope.editableRange.endLine} (do NOT mutate outside this range).`);
  }
  if (scope.lockedBindings.length) {
    lines.push(`Locked intent bindings (preserve verbatim): ${scope.lockedBindings.join(', ')}`);
  }
  if (scope.scopeType === 'site') {
    lines.push('Site scope may coordinate multiple routes, but change only the targets required by the interpreted request; preserve unrelated pages, bindings, and global tokens.');
  } else if (scope.scopeType === 'page') {
    lines.push('Keep changes within this page. Do not alter other routes, shared navigation, or global tokens unless the interpreted request explicitly requires them.');
  } else if (scope.scopeType === 'section') {
    lines.push('Keep changes within this section. Do not alter neighboring sections, other pages, routes, or global tokens.');
  } else {
    lines.push('Keep changes within this selected target and preserve its surrounding structure and bindings.');
  }
  return lines.join('\n');
}
