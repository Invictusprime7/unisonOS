/**
 * PatchPlan — the canonical mutation proposal shape accepted by
 * VFSCommitService. Every mutation source (AI Builder, Playground edits,
 * layout fast path, GHL binding path, system restore) produces a PatchPlan;
 * the commit service is the only code path that turns one into a new
 * SiteBundleSnapshot.
 *
 * Legacy callers that still produce raw `Record<string,string>` file maps
 * should funnel through `legacyFilesToPatchPlan` so the commit service
 * remains the single legal writer.
 */

import type { BusinessSystemState } from '@/platform/core/capabilityRegistry';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import { assertBackendOps } from './backendOperations';
import type { BackendOp } from './backendOperations';
import { assertDataOps } from './dataOperations';
import type { DataOp } from './dataOperations';
import { isCoreIntent } from '@/platform/core/coreIntents';
export type { BackendOp } from './backendOperations';
export type { DataOp } from './dataOperations';

export type PatchSource =
  | 'wizard-launch'
  | 'ai-builder'
  | 'playground-edit'
  | 'layout-fast-path'
  | 'preview-toolbar'
  | 'binding-fast-path'
  | 'ghl-binding'
  | 'theme-change'
  | 'republish'
  | 'system-restore';

export type FileOp =
  | { type: 'create'; path: string; contents: string }
  | { type: 'replace'; path: string; contents: string }
  | { type: 'delete'; path: string };

export interface PlaygroundOp {
  type:
    | 'updateSection'
    | 'addSection'
    | 'removeSection'
    | 'reorderSection'
    | 'updatePage'
    | 'addPage'
    | 'removePage'
    | 'updateTheme';
  pageId?: string;
  sectionId?: string;
  payload?: unknown;
}

export interface BindingOp {
  type: 'bindIntent' | 'unbindIntent';
  elementId: string;
  intent?: string;
  payload?: Record<string, unknown>;
}

/**
 * Snapshot-owned visual mutations. These never rewrite page JSX directly:
 * they mutate the sealed design intervention and the canonical compiler
 * re-projects the pages (see `@/services/builder/semanticPresentationOps`).
 */
export interface PresentationSectionCopy {
  headline?: string;
  subheadline?: string;
  description?: string;
}

export type PresentationOp =
  | { type: 'setVariant'; sectionId: string; variantId: string }
  /**
   * §7.7 — a site-wide ("all pages") design edit. Mutates the shared design
   * authority for a whole section family and clears page-local overrides so
   * every page inherits it. Explicit exceptions stay page-local.
   */
  | { type: 'setFamilyVariant'; sectionType: string; variantId: string; exceptPageRoles?: string[] }
  | { type: 'setSectionCopy'; pageRole: string; sectionType: string; copy: PresentationSectionCopy }
  | { type: 'reorderSections'; pageRole: string; sectionOrder: string[] }
  | { type: 'removeSection'; pageRole: string; sectionType: string }
  | { type: 'setMotionBudget'; motionBudget: 'restrained' | 'expressive' }
  | { type: 'setLayoutRecipe'; layoutRecipe: 'floating-navbar' | 'collage-hero' | 'bento-features' | 'media-card-grid' | 'conversion-form' | 'rich-footer' };


export interface PatchPlan {
  themeEdit?: import('@/services/theme/themeEdit').ThemeEdit;
  summary: string;
  /** Local mutation identities atomically acknowledged by this revision. */
  operationIds?: string[];
  fileOps: FileOp[];
  playgroundOps: PlaygroundOp[];
  bindingOps: BindingOp[];
  /** Registry-scoped data/binding mutations executed only by commitMutation. */
  dataOps: DataOp[];
  backendOps: BackendOp[];
  presentationOps: PresentationOp[];
  /** Typed page/route mutations; the compiler owns App.tsx projection. */
  routeOps?: TopologyChange[];
  /** Immutable context for an AI candidate; persisted with the revision patch. */
  candidate?: {
    id: string;
    baseRevisionId?: string;
    origin: 'builder' | 'wizard' | 'repair';
    intent?: string;
    knowledgeVersion: string;
    evidence?: import('@/services/builder/canonicalAuthoringRequest').CanonicalAuthorshipEvidence;
    targetPages: string[];
    requestedDependencies?: string[];
    dependencyGraphFingerprint?: string;
    attempt: number;
  };
  /** Approved capability state to stamp into the resulting SiteBundleSnapshot. */
  businessSystem?: BusinessSystemState;
}

export function emptyPatchPlan(summary = ''): PatchPlan {
  return {
    summary,
    fileOps: [],
    playgroundOps: [],
    bindingOps: [],
    dataOps: [],
    backendOps: [],
    presentationOps: [],
  };
}

/**
 * Adapter: wrap a legacy raw file map (the shape AIBuilderPanel currently
 * emits via `onApplyToVFS`) into a PatchPlan composed entirely of `replace`
 * ops. Lets us route legacy callers through the commit service while we
 * migrate prompts to emit structured PatchPlans.
 */
export function legacyFilesToPatchPlan(
  files: Record<string, string>,
  summary = 'legacy file-map patch',
): PatchPlan {
  const fileOps: FileOp[] = Object.entries(files ?? {}).map(([path, contents]) => ({
    type: 'replace' as const,
    path,
    contents,
  }));
  return {
    summary,
    fileOps,
    playgroundOps: [],
    bindingOps: [],
    dataOps: [],
    backendOps: [],
    presentationOps: [],
  };
}

/** Lightweight runtime validator — throws on obvious shape violations. */
export function assertPatchPlan(plan: unknown, context = 'assertPatchPlan'): asserts plan is PatchPlan {
  if (!plan || typeof plan !== 'object') {
    throw new Error(`[${context}] PatchPlan must be an object`);
  }
  const p = plan as Partial<PatchPlan>;
  for (const key of ['fileOps', 'playgroundOps', 'bindingOps', 'dataOps', 'backendOps', 'presentationOps'] as const) {
    if (!Array.isArray(p[key])) {
      throw new Error(`[${context}] PatchPlan.${key} must be an array`);
    }
  }
  for (const op of p.fileOps as FileOp[]) {
    if (!op || typeof op !== 'object' || typeof op.path !== 'string') {
      throw new Error(`[${context}] invalid FileOp: ${JSON.stringify(op)}`);
    }
    if (op.type !== 'create' && op.type !== 'replace' && op.type !== 'delete') {
      throw new Error(`[${context}] FileOp.type must be create|replace|delete`);
    }
    if ((op.type === 'create' || op.type === 'replace') && typeof (op as { contents?: unknown }).contents !== 'string') {
      throw new Error(`[${context}] FileOp.contents required for ${op.type}`);
    }
  }
  if (p.operationIds !== undefined && (
    !Array.isArray(p.operationIds)
    || p.operationIds.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(p.operationIds).size !== p.operationIds.length
  )) {
    throw new Error(`[${context}] PatchPlan.operationIds must contain unique non-empty strings`);
  }
  for (const op of p.presentationOps as PresentationOp[]) {
    if (!op || typeof op !== 'object' || !isValidPresentationOp(op)) {
      throw new Error(`[${context}] invalid PresentationOp: ${JSON.stringify(op)}`);
    }
  }
  assertBindingOps(p.bindingOps as BindingOp[], context);
  assertDataOps(p.dataOps, context);
  assertBackendOps(p.backendOps, context);
  if (p.routeOps !== undefined) {
    if (!Array.isArray(p.routeOps)) throw new Error(`[${context}] PatchPlan.routeOps must be an array`);
    for (const op of p.routeOps) {
      if (!op || typeof op !== 'object' || !['add_page', 'remove_page', 'rename_page', 'set_home', 'toggle_nav', 'reorder'].includes(op.type)) {
        throw new Error(`[${context}] invalid route operation`);
      }
      if (op.type === 'add_page' && (
        typeof op.pageId !== 'string' || !op.pageId.trim()
        || typeof op.title !== 'string' || !op.title.trim()
        || typeof op.route !== 'string' || !/^\/[A-Za-z0-9/_-]*$/.test(op.route)
      )) throw new Error(`[${context}] add_page requires a stable pageId, title and absolute route`);
      if (op.type !== 'add_page' && (typeof op.pageId !== 'string' || !op.pageId.trim())) {
        throw new Error(`[${context}] ${op.type} requires pageId`);
      }
      if (op.type === 'rename_page' && op.newRoute !== undefined && !/^\/[A-Za-z0-9/_-]*$/.test(op.newRoute)) {
        throw new Error(`[${context}] rename_page.newRoute must be an absolute route`);
      }
    }
  }
}

/** Binding operations may only target a stable rendered binding identity. */
export function assertBindingOps(operations: BindingOp[], context = 'assertBindingOps'): void {
  const addressed = new Set<string>();
  for (const op of operations) {
    if (!op || typeof op !== 'object' || (op.type !== 'bindIntent' && op.type !== 'unbindIntent')
      || typeof op.elementId !== 'string' || !op.elementId.trim()) {
      throw new Error(`[${context}] invalid BindingOp: ${JSON.stringify(op)}`);
    }
    if (addressed.has(op.elementId)) {
      throw new Error(`[${context}] BindingOps may address an element only once: ${op.elementId}`);
    }
    addressed.add(op.elementId);
    if (op.type === 'bindIntent' && (typeof op.intent !== 'string' || !isCoreIntent(op.intent))) {
      throw new Error(`[${context}] bindIntent requires a registered intent`);
    }
    if (op.type === 'unbindIntent' && op.intent !== undefined) {
      throw new Error(`[${context}] unbindIntent must not include an intent`);
    }
    if (op.payload !== undefined && (!op.payload || typeof op.payload !== 'object' || Array.isArray(op.payload))) {
      throw new Error(`[${context}] BindingOp.payload must be an object when supplied`);
    }
  }
}

const COPY_FIELDS = ['headline', 'subheadline', 'description'] as const;

function isValidPresentationOp(op: PresentationOp): boolean {
  switch (op.type) {
    case 'setVariant':
      return typeof op.sectionId === 'string' && typeof op.variantId === 'string';
    case 'setFamilyVariant':
      return typeof op.sectionType === 'string'
        && typeof op.variantId === 'string'
        && (op.exceptPageRoles === undefined
          || (Array.isArray(op.exceptPageRoles) && op.exceptPageRoles.every((role) => typeof role === 'string')));

    case 'setSectionCopy': {
      if (typeof op.pageRole !== 'string' || typeof op.sectionType !== 'string') return false;
      if (!op.copy || typeof op.copy !== 'object') return false;
      const entries = Object.entries(op.copy);
      if (entries.length === 0) return false;
      return entries.every(([key, value]) =>
        (COPY_FIELDS as readonly string[]).includes(key) && typeof value === 'string');
    }
    case 'reorderSections':
      return typeof op.pageRole === 'string'
        && Array.isArray(op.sectionOrder)
        && op.sectionOrder.length > 0
        && op.sectionOrder.every((type) => typeof type === 'string');
    case 'removeSection':
      return typeof op.pageRole === 'string' && typeof op.sectionType === 'string';
    case 'setMotionBudget':
      return op.motionBudget === 'restrained' || op.motionBudget === 'expressive';
    case 'setLayoutRecipe':
      return typeof op.layoutRecipe === 'string';
    default:
      return false;
  }
}
