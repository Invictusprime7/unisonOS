/**
 * catalogOperations — compatibility tool vocabulary over agentOperations
 * and the existing section/card binding services. Record storage is owned
 * by Resource Runtime, not this adapter.
 *
 * Milestone 5 (AI Catalog Intelligence Pass):
 * Instead of hand-editing TSX to change card copy, prices, sort order,
 * data source or collection, the assistant proposes one of the
 * operations declared here. Every op is registry-aware:
 *   - `surfaceId` MUST be a registered surface (services/products/menu/…);
 *     legacy aliases are resolved to the canonical id.
 *   - Row patches are normalized against the surface's `fields` map so
 *     `price` lands in `price_cents` vs `price` correctly.
 *   - Binding patches route through `sectionDataBindingService.patchBindingById`
 *     and can also be located by (projectId + pagePath + sectionId [+ slotKey]).
 *
 * The `CATALOG_OPERATION_TOOLS` export is a JSON-schema catalog suitable
 * for a chat-completions/tool-calling loop. Downstream orchestrators map
 * `tool.name` → `applyCatalogOperation({ op, args })`.
 */

import { supabase } from '@/integrations/supabase/client';
import { agentOperations } from '@/services/agent-runtime/operations';
import type { CatalogPatch } from '@/services/agent-runtime/catalogOps';
import {
  CATALOG_SURFACES,
  getCatalogSurface,
  type CatalogSurface,
} from '@/platform/core/catalogSurfaceRegistry';
import { getCmsRecord } from '@/services/cmsRecordService';
import {
  getBinding,
  getBindingById,
  patchBindingById,
  upsertBinding,
  type BindingPatch,
  type UpsertBindingInput,
} from '@/services/sectionDataBindingService';
import {
  updateCatalogCardBinding,
  updateCatalogCardPresentation,
  upsertCatalogCardBinding,
} from '@/services/catalogCardBindingService';
import type { CatalogBindingActions, CatalogBindingPresentation } from '@/types/catalog';
import type { CatalogFallbackMode } from '@/platform/core/catalogSurfaceRegistry';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CatalogOperationName =
  | 'createCatalogRow'
  | 'updateCatalogRow'
  | 'updateCatalogItem'
  | 'deleteCatalogRow'
  | 'bindCatalogItemToComponent'
  | 'updateComponentPresentation'
  | 'updateComponentActions'
  | 'updateSectionBinding'
  | 'switchSectionCollection'
  | 'changeSectionLimit'
  | 'changeSectionSort'
  | 'changeSectionFallback';

export interface CatalogRowFieldPatch {
  // Registry-normalized fields (converted per-surface):
  name?: string | null;
  description?: string | null;
  /** Price in DOLLARS. Written to price_cents (×100) or price depending on surface. */
  price?: number | null;
  image_url?: string | null;
  // Passthrough columns for advanced writes (validated against surface):
  [column: string]: unknown;
}

export interface SectionBindingLocator {
  /** Preferred: the binding row id. */
  bindingId?: string;
  /** Fallback: locate by (projectId, pagePath, sectionId, slotKey?). */
  projectId?: string;
  pagePath?: string;
  sectionId?: string;
  slotKey?: string | null;
}

export interface CatalogOperationResult {
  ok: boolean;
  op: CatalogOperationName;
  message: string;
  data?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveSurfaceOrFail(surfaceId: string): CatalogSurface {
  const s = getCatalogSurface(surfaceId);
  if (!s) {
    throw new Error(
      `Unknown catalog surfaceId "${surfaceId}". Registered surfaces: ${Object.keys(
        CATALOG_SURFACES,
      ).join(', ')}`,
    );
  }
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization — enforce RLS-aligned membership BEFORE any mutation.
// The DB has RLS + is_business_member / is_project_member security-definer
// helpers; we mirror those checks client-side so the AI's tool calls fail
// fast with a friendly message instead of a raw Postgres error, and so we
// never issue a mutation the current user is not entitled to make.
// ─────────────────────────────────────────────────────────────────────────────

const UNAUTHORIZED_SIGN_IN = 'Please sign in to edit catalog data.';
const UNAUTHORIZED_BUSINESS =
  "You don't have permission to edit this business's catalog.";
const UNAUTHORIZED_PROJECT =
  "You don't have permission to edit this project's section bindings.";

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function assertBusinessAccess(
  businessId: string | null | undefined,
  permission: 'catalog.write' | 'catalog.delete' | 'artifact.write',
): Promise<string | null> {
  if (!businessId) return 'businessId is required for this catalog operation.';
  const uid = await currentUserId();
  if (!uid) return UNAUTHORIZED_SIGN_IN;
  const { data, error } = await supabase.rpc(
    'business_has_permission' as never,
    { p_business_id: businessId, p_permission: permission } as never,
  );
  if (error) return `Authorization check failed: ${error.message}`;
  if (data !== true) return UNAUTHORIZED_BUSINESS;
  return null;
}

async function assertProjectAccess(
  projectId: string | null | undefined,
): Promise<string | null> {
  if (!projectId) return 'projectId is required for this catalog operation.';
  const uid = await currentUserId();
  if (!uid) return UNAUTHORIZED_SIGN_IN;
  const { data, error } = await supabase.rpc(
    'is_project_member' as never,
    { _user_id: uid, _project_id: projectId } as never,
  );
  if (error) return `Authorization check failed: ${error.message}`;
  if (data !== true) return UNAUTHORIZED_PROJECT;
  return null;
}

/** Look up the owning project/business for a binding row. */
async function fetchBindingScope(
  bindingId: string,
): Promise<{ projectId: string | null; businessId: string | null }> {
  const { data } = await supabase
    .from('site_data_bindings' as never)
    .select('project_id, business_id')
    .eq('id', bindingId)
    .maybeSingle();
  const row = data as { project_id?: string; business_id?: string } | null;
  return {
    projectId: row?.project_id ?? null,
    businessId: row?.business_id ?? null,
  };
}


async function locateBindingId(
  locator: SectionBindingLocator,
): Promise<string | null> {
  if (locator.bindingId) return locator.bindingId;
  if (locator.projectId && locator.pagePath && locator.sectionId) {
    const row = await getBinding(
      locator.projectId,
      locator.pagePath,
      locator.sectionId,
      locator.slotKey ?? null,
    );
    return row?.id ?? null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row operations (M5)
// ─────────────────────────────────────────────────────────────────────────────

// Row create/update/delete are owned by agentOperations (src/services/agent-runtime).
// The AI's row tools below dispatch there so there is one catalog writer.
async function rowOp(op: CatalogOperationName, args: Record<string, unknown>): Promise<CatalogOperationResult> {
  const surfaceId = String(args.surfaceId ?? '');
  const businessId = String(args.businessId ?? '');
  const rowId = String(args.rowId ?? args.itemId ?? '');
  const projectId = typeof args.projectId === 'string' ? args.projectId : null;
  const ctx = { files: {}, businessId, projectId };
  if (op === 'createCatalogRow') {
    const item = await agentOperations.create_catalog_item(ctx, surfaceId, (args.patch ?? {}) as CatalogPatch);
    return { ok: true, op, message: `Created ${item.name}`, data: { id: item.id, surfaceId } };
  }
  if (op === 'deleteCatalogRow') {
    await agentOperations.delete_catalog_item(ctx, surfaceId, rowId);
    return { ok: true, op, message: `Deleted ${rowId}`, data: { surfaceId, rowId } };
  }
  const { summary } = await agentOperations.update_catalog_item(ctx, surfaceId, rowId, (args.patch ?? {}) as CatalogPatch);
  return { ok: true, op, message: summary, data: { surfaceId, rowId } };
}

export async function bindCatalogItemToComponent(args: {
  businessId: string;
  projectId: string;
  snapshotId?: string | null;
  pagePath: string;
  componentId: string;
  slotKey?: string | null;
  surfaceId: string;
  itemId: string;
  presentation?: Partial<CatalogBindingPresentation>;
  actions?: CatalogBindingActions;
}): Promise<CatalogOperationResult> {
  const surface = resolveSurfaceOrFail(args.surfaceId);
  const [projectDenied, businessDenied] = await Promise.all([
    assertProjectAccess(args.projectId),
    assertBusinessAccess(args.businessId, 'artifact.write'),
  ]);
  const denied = projectDenied ?? businessDenied;
  if (denied) return { ok: false, op: 'bindCatalogItemToComponent', message: denied };
  try {
    await getCmsRecord({
      businessId: args.businessId,
      resource: surface.surfaceId,
      recordId: args.itemId,
    });
  } catch {
    return {
      ok: false,
      op: 'bindCatalogItemToComponent',
      message: 'The catalog item does not belong to the selected business.',
    };
  }
  const binding = await upsertCatalogCardBinding(args);
  return {
    ok: !!binding,
    op: 'bindCatalogItemToComponent',
    message: binding ? `Bound catalog item ${args.itemId} to component ${args.componentId}` : 'binding upsert failed',
    data: binding,
  };
}

export async function updateComponentPresentation(args: {
  bindingId: string;
  patch: Partial<CatalogBindingPresentation>;
}): Promise<CatalogOperationResult> {
  const current = await getBindingById(args.bindingId);
  if (!current) {
    return { ok: false, op: 'updateComponentPresentation', message: 'Card binding not found.' };
  }
  const denied = current.projectId
    ? await assertProjectAccess(current.projectId)
    : await assertBusinessAccess(current.businessId, 'artifact.write');
  if (denied) return { ok: false, op: 'updateComponentPresentation', message: denied };
  const binding = await updateCatalogCardPresentation(args.bindingId, args.patch);
  return {
    ok: !!binding,
    op: 'updateComponentPresentation',
    message: binding ? `Updated presentation for component ${binding.sectionId}` : 'presentation update failed',
    data: binding,
  };
}

export async function updateComponentActions(args: {
  bindingId: string;
  actions: CatalogBindingActions;
}): Promise<CatalogOperationResult> {
  const current = await getBindingById(args.bindingId);
  if (!current) {
    return { ok: false, op: 'updateComponentActions', message: 'Card binding not found.' };
  }
  const denied = current.projectId
    ? await assertProjectAccess(current.projectId)
    : await assertBusinessAccess(current.businessId, 'artifact.write');
  if (denied) return { ok: false, op: 'updateComponentActions', message: denied };
  const binding = await updateCatalogCardBinding(args.bindingId, { actions: args.actions });
  return {
    ok: !!binding,
    op: 'updateComponentActions',
    message: binding ? `Updated actions for component ${binding.sectionId}` : 'action update failed',
    data: binding,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Binding operations (M5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one-stop binding patcher. Prefer the specific helpers below when the
 * intent is narrow (limit/sort/collection/fallback) — this exists for
 * multi-field edits ("show only featured services, limit 3").
 */
export async function updateSectionBinding(args: {
  surfaceId: string;
  locator?: SectionBindingLocator;
  /** Full upsert input for the case where the binding does not yet exist. */
  upsert?: UpsertBindingInput;
  patch: BindingPatch;
}): Promise<CatalogOperationResult> {
  resolveSurfaceOrFail(args.surfaceId); // validate surface exists

  const id = args.locator ? await locateBindingId(args.locator) : null;
  if (id) {
    // Authorize against the binding's owning project (falls back to
    // business membership if the row has no project_id).
    const scope = await fetchBindingScope(id);
    const denied = scope.projectId
      ? await assertProjectAccess(scope.projectId)
      : await assertBusinessAccess(scope.businessId, 'artifact.write');
    if (denied) return { ok: false, op: 'updateSectionBinding', message: denied };
    const dto = await patchBindingById(id, args.patch);
    return {
      ok: !!dto,
      op: 'updateSectionBinding',
      message: dto ? `Patched binding ${id}` : `Patch failed for binding ${id}`,
      data: dto,
    };
  }

  if (!args.upsert) {
    return {
      ok: false,
      op: 'updateSectionBinding',
      message:
        'No existing binding found and no upsert payload provided. Include upsert:{businessId,projectId,pagePath,sectionId,sourceKind}.',
    };
  }
  // Upsert path: caller must own the target project (or business, if no project).
  const upsertProjectId = (args.upsert as { projectId?: string }).projectId ?? null;
  const upsertBusinessId = (args.upsert as { businessId?: string }).businessId ?? null;
  const denied = upsertProjectId
    ? await assertProjectAccess(upsertProjectId)
    : await assertBusinessAccess(upsertBusinessId, 'artifact.write');
  if (denied) return { ok: false, op: 'updateSectionBinding', message: denied };
  const dto = await upsertBinding({
    ...args.upsert,
    ...args.patch,
  });
  return {
    ok: !!dto,
    op: 'updateSectionBinding',
    message: dto ? `Upserted binding ${dto.id}` : 'upsert failed',
    data: dto,
  };
}

export async function switchSectionCollection(args: {
  surfaceId: string;
  locator: SectionBindingLocator;
  collectionId: string | null;
}): Promise<CatalogOperationResult> {
  return updateSectionBinding({
    surfaceId: args.surfaceId,
    locator: args.locator,
    patch: { collectionId: args.collectionId },
  }).then((r) => ({ ...r, op: 'switchSectionCollection' }));
}

export async function changeSectionLimit(args: {
  surfaceId: string;
  locator: SectionBindingLocator;
  limitCount: number | null;
}): Promise<CatalogOperationResult> {
  return updateSectionBinding({
    surfaceId: args.surfaceId,
    locator: args.locator,
    patch: { limitCount: args.limitCount },
  }).then((r) => ({ ...r, op: 'changeSectionLimit' }));
}

export async function changeSectionSort(args: {
  surfaceId: string;
  locator: SectionBindingLocator;
  sort: { field?: string; direction?: 'asc' | 'desc' };
}): Promise<CatalogOperationResult> {
  return updateSectionBinding({
    surfaceId: args.surfaceId,
    locator: args.locator,
    patch: { sort: args.sort },
  }).then((r) => ({ ...r, op: 'changeSectionSort' }));
}

export async function changeSectionFallback(args: {
  surfaceId: string;
  locator: SectionBindingLocator;
  fallbackMode: CatalogFallbackMode;
}): Promise<CatalogOperationResult> {
  return updateSectionBinding({
    surfaceId: args.surfaceId,
    locator: args.locator,
    patch: { fallbackMode: args.fallbackMode },
  }).then((r) => ({ ...r, op: 'changeSectionFallback' }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export async function applyCatalogOperation(
  op: CatalogOperationName,
  args: Record<string, unknown>,
): Promise<CatalogOperationResult> {
  try {
    switch (op) {
      case 'createCatalogRow':
      case 'updateCatalogRow':
      case 'updateCatalogItem':
      case 'deleteCatalogRow':
        return await rowOp(op, args);
      case 'bindCatalogItemToComponent':
        return await bindCatalogItemToComponent(args as never);
      case 'updateComponentPresentation':
        return await updateComponentPresentation(args as never);
      case 'updateComponentActions':
        return await updateComponentActions(args as never);
      case 'updateSectionBinding':
        return await updateSectionBinding(args as never);
      case 'switchSectionCollection':
        return await switchSectionCollection(args as never);
      case 'changeSectionLimit':
        return await changeSectionLimit(args as never);
      case 'changeSectionSort':
        return await changeSectionSort(args as never);
      case 'changeSectionFallback':
        return await changeSectionFallback(args as never);
      default:
        return { ok: false, op, message: `Unknown catalog op "${op}"` };
    }
  } catch (err) {
    return {
      ok: false,
      op,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool schemas (for tool-calling LLM loops)
// ─────────────────────────────────────────────────────────────────────────────

const SURFACE_IDS = Object.keys(CATALOG_SURFACES);

const LOCATOR_SCHEMA = {
  type: 'object',
  description:
    'How to locate the site_data_bindings row. Prefer bindingId. Otherwise pass projectId + pagePath + sectionId (+ optional slotKey).',
  properties: {
    bindingId: { type: 'string' },
    projectId: { type: 'string' },
    pagePath: { type: 'string' },
    sectionId: { type: 'string' },
    slotKey: { type: ['string', 'null'] },
  },
} as const;

const ROW_PATCH_SCHEMA = {
  type: 'object',
  description:
    'Row patch. Use editable shape (name, description, price [dollars], image_url) OR pass raw column names declared in the surface editableFields.',
  additionalProperties: true,
  properties: {
    name: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    price: {
      type: ['number', 'null'],
      description: 'Price in DOLLARS. Auto-converted to price_cents when the surface stores cents.',
    },
    image_url: { type: ['string', 'null'] },
  },
} as const;

const CARD_PRESENTATION_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    showImage: { type: 'boolean' },
    showDescription: { type: 'boolean' },
    showPrice: { type: 'boolean' },
    showCTA: { type: 'boolean' },
    imageAspectRatio: { type: 'string' },
    layout: { type: 'string' },
    typography: { type: 'string' },
    alignment: { type: 'string' },
    ctaStyle: { type: 'string' },
    featuredBadge: { type: 'boolean' },
  },
} as const;

export const CATALOG_OPERATION_TOOLS = [
  {
    name: 'createCatalogRow',
    description:
      'Create a new row in a catalog surface (service/product/menu item/pricing plan/offer/testimonial/portfolio project).',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'businessId', 'patch'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        businessId: { type: 'string' },
        projectId: { type: 'string' },
        patch: ROW_PATCH_SCHEMA,
      },
    },
  },
  {
    name: 'updateCatalogRow',
    description:
      'Patch fields on an existing catalog row. Prices go in DOLLARS in the patch (converted to cents when needed).',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'businessId', 'rowId', 'patch'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        businessId: { type: 'string' },
        projectId: { type: 'string' },
        rowId: { type: 'string' },
        patch: ROW_PATCH_SCHEMA,
      },
    },
  },
  {
    name: 'updateCatalogItem',
    description:
      'Update the real catalog record referenced by a rendered card. Use this for content changes, never a TSX text rewrite.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'businessId', 'itemId', 'patch'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        businessId: { type: 'string' },
        projectId: { type: 'string' },
        itemId: { type: 'string' },
        patch: ROW_PATCH_SCHEMA,
      },
    },
  },
  {
    name: 'bindCatalogItemToComponent',
    description:
      'Bind one generated card component to a real catalog item. The binding is tenant-scoped and is hydrated by preview and published runtime.',
    parameters: {
      type: 'object',
      required: ['businessId', 'projectId', 'pagePath', 'componentId', 'surfaceId', 'itemId'],
      properties: {
        businessId: { type: 'string' },
        projectId: { type: 'string' },
        snapshotId: { type: ['string', 'null'] },
        pagePath: { type: 'string' },
        componentId: { type: 'string' },
        slotKey: { type: ['string', 'null'] },
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        itemId: { type: 'string' },
        presentation: CARD_PRESENTATION_SCHEMA,
        actions: {
          type: 'object',
          properties: {
            primary: { type: 'string', enum: ['cart.add', 'booking.start', 'quote.request'] },
            secondary: { type: 'string', enum: ['catalog.view_details'] },
          },
        },
      },
    },
  },
  {
    name: 'updateComponentPresentation',
    description:
      'Change only how a bound catalog card renders. It never mutates the catalog record.',
    parameters: {
      type: 'object',
      required: ['bindingId', 'patch'],
      properties: {
        bindingId: { type: 'string' },
        patch: CARD_PRESENTATION_SCHEMA,
      },
    },
  },
  {
    name: 'updateComponentActions',
    description:
      'Change the approved CTA actions for a bound catalog card without mutating catalog content or TSX.',
    parameters: {
      type: 'object',
      required: ['bindingId', 'actions'],
      properties: {
        bindingId: { type: 'string' },
        actions: {
          type: 'object',
          properties: {
            primary: { type: 'string', enum: ['cart.add', 'booking.start', 'quote.request'] },
            secondary: { type: 'string', enum: ['catalog.view_details'] },
          },
        },
      },
    },
  },
  {
    name: 'deleteCatalogRow',
    description: 'Delete an existing catalog row.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'businessId', 'rowId'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        businessId: { type: 'string' },
        projectId: { type: 'string' },
        rowId: { type: 'string' },
      },
    },
  },
  {
    name: 'updateSectionBinding',
    description:
      'Patch a site_data_bindings row (filters/sort/limit/collection/fallback/displayMapping). If no existing binding matches the locator, provide an `upsert` payload to create it.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'patch'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        locator: LOCATOR_SCHEMA,
        upsert: {
          type: 'object',
          properties: {
            businessId: { type: 'string' },
            projectId: { type: 'string' },
            pagePath: { type: 'string' },
            sectionId: { type: 'string' },
            slotKey: { type: ['string', 'null'] },
            sourceKind: { type: 'string' },
            sourceTable: { type: 'string' },
          },
        },
        patch: {
          type: 'object',
          properties: {
            collectionId: { type: ['string', 'null'] },
            filters: { type: 'object', additionalProperties: true },
            sort: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                direction: { type: 'string', enum: ['asc', 'desc'] },
              },
            },
            limitCount: { type: ['number', 'null'] },
            displayMapping: { type: 'object', additionalProperties: { type: 'string' } },
            fallbackMode: { type: 'string', enum: ['empty_state', 'hide_section', 'show_placeholder'] },
          },
        },
      },
    },
  },
  {
    name: 'switchSectionCollection',
    description: 'Point a bound section at a different collection (or clear with null).',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'locator', 'collectionId'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        locator: LOCATOR_SCHEMA,
        collectionId: { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'changeSectionLimit',
    description: 'Set the max number of rows a bound section renders. Pass null to remove the limit.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'locator', 'limitCount'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        locator: LOCATOR_SCHEMA,
        limitCount: { type: ['number', 'null'] },
      },
    },
  },
  {
    name: 'changeSectionSort',
    description: 'Change the sort field/direction of a bound section.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'locator', 'sort'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        locator: LOCATOR_SCHEMA,
        sort: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            direction: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
    },
  },
  {
    name: 'changeSectionFallback',
    description: 'Change what a bound section renders when there are no rows.',
    parameters: {
      type: 'object',
      required: ['surfaceId', 'locator', 'fallbackMode'],
      properties: {
        surfaceId: { type: 'string', enum: SURFACE_IDS },
        locator: LOCATOR_SCHEMA,
        fallbackMode: { type: 'string', enum: ['empty_state', 'hide_section', 'show_placeholder'] },
      },
    },
  },
] as const;
