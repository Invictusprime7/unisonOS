/**
 * Agent Runtime — one registry of typed operations shared by the AI Builder
 * and the command menu. Inspect operations read live canonical state; mutate
 * operations only *propose* file changes, which callers hand to the existing
 * transaction (`runBuilderAiMutation` → `commitMutation`). No new writer.
 */
import { executeEditorCommand } from '@/services/editor/editorCommandService';
import { readEditorResource } from '@/services/editor/executors/resourceExecutor';
import { collectIntentTargets } from './intentInvariant';
import {
  listCatalog, createCatalogItem, updateCatalogItemRow, deleteCatalogItem,
  type CatalogItem, type CatalogPatch,
} from './catalogOps';
import {
  buildSystemGraph,
  findGraphNode,
  graphEdgesFor,
  type GraphDiagnostic,
  type SystemGraphBackendActionInput,
  type SystemGraphInput,
  type SystemGraphSchemaInput,
} from './systemGraph';
import { resolveEditableEntity, type EditableSelection } from './editableOwnershipResolver';
import { listResources, getResource } from '@/services/resources/resourceRegistry';
import { queryResource, parseResourceProvenance } from '@/services/resources/resourceRuntime';
import { getCatalogSurfaceByTable } from '@/platform/core/catalogSurfaceRegistry';
import type { ResourceDefinition, ResourceRecord } from '@/services/resources/resourceTypes';
import { removeSection, moveSection, restyleSection, swapVariant, type SectionActionResult } from './sectionActions';
import { isCoreIntent } from '@/platform/core/coreIntents';
import type { BindingOp } from '@/types/patchPlan';

export interface AgentContext {
  files: Record<string, string>;
  businessId?: string | null;
  projectId?: string | null;
  previewErrors?: string[];
  /** Canonical state made available by the Builder; inspection only. */
  revisionId?: string | null;
  snapshot?: SystemGraphInput['snapshot'];
  runtimeManifest?: SystemGraphInput['runtimeManifest'];
  schema?: SystemGraphSchemaInput | null;
  backendActions?: SystemGraphBackendActionInput[];
  diagnostics?: GraphDiagnostic[];
}

export type ProposedChange = { files: Record<string, string>; summary: string };
/** Structured proposals are consumed by the existing AI candidate → PatchPlan path. */
export type ProposedMutation = { bindingOps: BindingOp[]; summary: string };

const CATALOG_TABLES = ['products', 'menu_items', 'services', 'pricing_plans', 'testimonials'] as const;
export type CatalogTable = (typeof CATALOG_TABLES)[number];

export const agentOperations = {
  inspect_file(ctx: AgentContext, path: string): string | null {
    return ctx.files[path] ?? null;
  },
  inspect_routes(ctx: AgentContext): string[] {
    return Object.keys(ctx.files).filter((p) => /^\/src\/pages\/.+\.(t|j)sx$/.test(p)).sort();
  },
  inspect_errors(ctx: AgentContext): string[] {
    return ctx.previewErrors ?? [];
  },
  inspect_intents(ctx: AgentContext): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    collectIntentTargets(ctx.files).forEach((v, k) => { out[k] = [...v]; });
    return out;
  },
  /** Rebuilds a fresh graph from the caller's canonical state; never caches or writes it. */
  inspect_system_graph(ctx: AgentContext) {
    return buildSystemGraph({
      files: ctx.files,
      revisionId: ctx.revisionId,
      snapshot: ctx.snapshot,
      runtimeManifest: ctx.runtimeManifest,
      schema: ctx.schema,
      backendActions: ctx.backendActions,
      diagnostics: ctx.diagnostics,
    });
  },
  inspect_graph_node(ctx: AgentContext, id: string): unknown | null {
    return findGraphNode(agentOperations.inspect_system_graph(ctx), id);
  },
  inspect_graph_edges(ctx: AgentContext, id: string) {
    return graphEdgesFor(agentOperations.inspect_system_graph(ctx), id);
  },
  /** Resolves a clicked preview node to its property-level canonical owners. */
  inspect_editable_entity(ctx: AgentContext, selectedElement: EditableSelection) {
    return resolveEditableEntity({ selectedElement, graph: agentOperations.inspect_system_graph(ctx) });
  },
  inspect_route(ctx: AgentContext, route: string) {
    return agentOperations.inspect_system_graph(ctx).routes.find((candidate) => candidate.path === route) ?? null;
  },
  inspect_dependencies(ctx: AgentContext) {
    return agentOperations.inspect_system_graph(ctx).dependencies;
  },
  inspect_capabilities(ctx: AgentContext) {
    return agentOperations.inspect_system_graph(ctx).capabilities;
  },
  inspect_schema(ctx: AgentContext) {
    return agentOperations.inspect_system_graph(ctx).database;
  },
  inspect_table(ctx: AgentContext, table: string) {
    return agentOperations.inspect_system_graph(ctx).database.tables.find((candidate) => candidate.name === table || candidate.id === table) ?? null;
  },
  inspect_policies(ctx: AgentContext, table?: string) {
    const graph = agentOperations.inspect_system_graph(ctx);
    return table
      ? graph.database.policies.filter((policy) => policy.tableId === `table:${table}` || policy.tableId === table)
      : graph.database.policies;
  },
  inspect_backend_actions(ctx: AgentContext) {
    return agentOperations.inspect_system_graph(ctx).backendActions;
  },
  inspect_preview(ctx: AgentContext) {
    return ctx.previewErrors ?? [];
  },
  /**
   * Typed section actions shared with the terminal. Proposals only; callers
   * commit through the canonical writer. Moved markup keeps button destinations.
   */
  propose_section_action(
    ctx: AgentContext,
    action:
      | { op: 'remove'; address: string }
      | { op: 'move'; address: string; direction: 'up' | 'down' }
      | { op: 'restyle'; address: string; className: string }
      | { op: 'variant'; address: string; to: string },
  ): ProposedChange {
    let r: SectionActionResult;
    switch (action.op) {
      case 'remove': r = removeSection(action.address, ctx.files); break;
      case 'move': r = moveSection(action.address, action.direction, ctx.files); break;
      case 'restyle': r = restyleSection(action.address, action.className, ctx.files); break;
      case 'variant': r = swapVariant(action.address, action.to, ctx.files); break;
    }
    if (r.ok === false) throw new Error(r.error);
    return { files: { [r.path]: r.contents }, summary: r.summary };
  },
  /**
   * Propose a canonical intent binding for the exact control selected in
   * preview. This returns data only; callers still run it through
   * runBuilderAiMutation → commitMutation.
   */
  propose_bind_intent(
    ctx: AgentContext,
    selectedElement: EditableSelection,
    intent: string,
    payload?: Record<string, unknown>,
  ): ProposedMutation {
    if (!isCoreIntent(intent)) throw new Error(`Unknown canonical intent: ${intent}`);
    const entity = agentOperations.inspect_editable_entity(ctx, selectedElement);
    if (!entity.allowedMutationLanes.includes('bindingOps')) {
      throw new Error('The selected entity is not a canonical behavior binding. Select a wired control before changing its intent.');
    }
    const bindingId = entity.provenance.bindingId ?? selectedElement.bindingId;
    if (!bindingId || !ctx.snapshot?.bindings?.[bindingId]) {
      throw new Error('The selected control has no canonical binding record. It cannot be rewired by source mutation.');
    }
    return {
      bindingOps: [{ type: 'bindIntent', elementId: bindingId, intent, payload }],
      summary: `Bind ${bindingId} to ${intent}`,
    };
  },
  /** Project-scoped catalog read through the normal access rules. */
  async inspect_data(ctx: AgentContext, table: CatalogTable, limit = 20): Promise<unknown[]> {
    if (!ctx.businessId || !CATALOG_TABLES.includes(table)) return [];
    const surface = getCatalogSurfaceByTable(table);
    if (!surface) return [];
    return (await queryResource(surface.surfaceId, { businessId: ctx.businessId, projectId: ctx.projectId, mode: 'builder' })).slice(0, Math.max(0, limit));
  },
  /** Propose CSS custom-property changes in the site stylesheet. */
  set_theme_tokens(ctx: AgentContext, tokens: Record<string, string>): ProposedChange | null {
    const path = '/src/index.css';
    let css = ctx.files[path];
    if (typeof css !== 'string') return null;
    for (const [name, value] of Object.entries(tokens)) {
      const key = name.startsWith('--') ? name : `--${name}`;
      const re = new RegExp(`(${key.replace(/[-]/g, '\\-')}\\s*:\\s*)[^;]+;`, 'g');
      css = re.test(css) ? css.replace(re, `$1${value};`) : css.replace(/:root\s*\{/, `:root {\n  ${key}: ${value};`);
    }
    return { files: { [path]: css }, summary: `Theme: ${Object.keys(tokens).join(', ')}` };
  },
  set_font(ctx: AgentContext, family: string, role: 'body' | 'display' = 'body'): ProposedChange | null {
    const change = agentOperations.set_theme_tokens(ctx, {
      [role === 'display' ? '--font-display' : '--font-sans']: `'${family}', system-ui, sans-serif`,
    });
    return change ? { ...change, summary: `Font (${role}): ${family}` } : null;
  },
  swap_image(ctx: AgentContext, path: string, fromUrl: string, toUrl: string): ProposedChange | null {
    const src = ctx.files[path];
    if (typeof src !== 'string' || !src.includes(fromUrl)) return null;
    return { files: { [path]: src.split(fromUrl).join(toUrl) }, summary: `Image swapped in ${path}` };
  },
  /** Live catalog (products, services, menu, plans) for this business. */
  async inspect_catalog(ctx: AgentContext): Promise<CatalogItem[]> {
    return ctx.businessId ? listCatalog(ctx.businessId, undefined, ctx.projectId) : [];
  },
  async create_catalog_item(ctx: AgentContext, surfaceId: string, patch: CatalogPatch): Promise<CatalogItem> {
    if (!ctx.businessId) throw new Error('No business is linked to this site.');
    return createCatalogItem(ctx.businessId, surfaceId, patch, ctx.projectId);
  },
  async hide_catalog_item(ctx: AgentContext, surfaceId: string, id: string, hidden = true) {
    return agentOperations.update_catalog_item(ctx, surfaceId, id, { active: !hidden });
  },
  async delete_catalog_item(ctx: AgentContext, surfaceId: string, id: string): Promise<void> {
    if (!ctx.businessId) throw new Error('No business is linked to this site.');
    await deleteCatalogItem(ctx.businessId, surfaceId, id, ctx.projectId);
  },
  /**
   * Write only the resolved catalog record. Resource invalidation refreshes
   * bound views; matching literals elsewhere never imply record ownership.
   */
  async update_catalog_item(
    ctx: AgentContext, surfaceId: string, id: string, patch: CatalogPatch, expected?: Record<string, unknown>,
  ): Promise<{ change: ProposedChange | null; summary: string; item: CatalogItem }> {
    if (!ctx.businessId) throw new Error('No business is linked to this site.');
    const { after } = await updateCatalogItemRow(ctx.businessId, surfaceId, id, patch, ctx.projectId, expected);
    const what = patch.price != null ? `price $${patch.price}` : patch.image_url ? 'new photo' : patch.active === false ? 'hidden' : 'updated';
    const summary = `${after.name}: ${what} saved`;
    return { change: null, summary, item: after };
  },
  /** Every editable record type (catalog, content, business details) and its editable fields. */
  list_resources(): Array<{
    key: string;
    label: string;
    kind: string;
    catalogKind?: ResourceDefinition['catalogKind'];
    fields: string[];
    fieldDefinitions: Array<{ key: string; label: string; type: string; required: boolean }>;
    capabilities?: ResourceDefinition['capabilities'];
  }> {
    return listResources().map((d) => {
      const fields = d.schema.filter((field) => field.editable);
      return {
        key: d.key,
        label: d.label,
        kind: d.kind,
        catalogKind: d.catalogKind,
        fields: fields.map((field) => field.key),
        fieldDefinitions: fields.map(({ key, label, type, required }) => ({ key, label, type, required: required === true })),
        capabilities: d.capabilities,
      };
    });
  },
  /** Read the record behind a `data-ut-resource` mark (builder mode: drafts visible). */
  async read_resource(ctx: AgentContext, provenance: string): Promise<ResourceRecord | null> {
    if (!ctx.businessId) throw new Error('No business is linked to this site.');
    const ref = parseResourceProvenance(provenance);
    if (!ref) throw new Error(`Unknown record mark "${provenance}".`);
    return readEditorResource(ref, { businessId: ctx.businessId, projectId: ctx.projectId, mode: 'builder' });
  },
  /**
   * Change one field of the record behind a `data-ut-resource` mark. Writes go
   * through ResourceRuntime (validated, editable-only, invalidates the preview);
   * no page file changes, so button destinations are untouched.
   */
  async update_resource_field(ctx: AgentContext, provenance: string, value: unknown, field?: string, expected?: Record<string, unknown>): Promise<{ summary: string; record: ResourceRecord | null }> {
    if (!ctx.businessId) throw new Error('No business is linked to this site.');
    const ref = parseResourceProvenance(provenance);
    if (!ref) throw new Error(`Unknown record mark "${provenance}".`);
    const key = field ?? ref.field;
    if (!key) throw new Error('Name the field to change.');
    const resource = { businessId: ctx.businessId, projectId: ctx.projectId, mode: 'builder' as const };
    const before = await readEditorResource(ref, resource);
    const result = await executeEditorCommand({
      type: 'update-resource-field', target: { ownerKind: 'resource', projectId: ctx.projectId }, ref,
      values: { [key]: value }, expected: expected ?? (before ? { [key]: before[key] ?? null } : undefined),
    }, { source: 'ai', resource });
    if (!result.ok) throw new Error(result.error ?? 'Could not save this field.');
    const record = result.record ?? null;
    const label = getResource(ref.resourceKey)?.schema.find((f) => f.key === key)?.label ?? key;
    return { summary: `${label} saved`, record };
  },
} as const;

export type AgentOperationName = keyof typeof agentOperations;
export const AGENT_OPERATION_NAMES = Object.keys(agentOperations) as AgentOperationName[];
