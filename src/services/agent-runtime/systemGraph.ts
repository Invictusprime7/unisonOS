/**
 * SystemGraph is a pure, revision-aware projection of canonical application
 * state. It is an index for inspection and planning, never a persistence
 * model: rebuild it after every accepted revision instead of writing to it.
 */
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { RuntimeManifest } from '@/types/runtimeManifest';
import { listTopologyPageRoleAliases } from '@/platform/core/siteTopologyPlanner';

export interface SystemGraphPageIdentity {
  id: string;
  path: string;
  filePath?: string;
  title?: string;
  role?: string;
}

export interface GraphRevisionIdentity {
  id: string;
  source: 'canonical-revision' | 'snapshot' | 'files';
  contentHash: string;
}

export interface GraphIntent { id: string; intent: string; label: string; target: string | null }
export interface GraphSection {
  /** Existing source-facing section identifier. */
  id: string;
  /** Stable graph entity identity. */
  nodeId: string;
  intents: GraphIntent[];
}
export interface GraphPage {
  id: string;
  path: string;
  name: string;
  route: string;
  sections: GraphSection[];
  intents: GraphIntent[];
  componentIds: string[];
}
export interface GraphRoute { id: string; path: string; pageId: string | null; requiresAuth: boolean }
export interface GraphComponent { id: string; name: string; aliases: string[]; sourcePath: string | null; usedByPageIds: string[] }
export interface GraphBinding { id: string; intentId: string; pageId: string | null; target: string | null }
export interface GraphCapability { id: string; capability: string; status: string | null }
export interface GraphBackendAction {
  id: string;
  name: string;
  capabilityId: string | null;
  tableIds: string[];
  readTableIds: string[];
  writtenTableIds: string[];
}
export interface GraphColumn { id: string; name: string; type?: string; nullable?: boolean }
export interface GraphTable { id: string; name: string; columns: GraphColumn[]; policyIds: string[] }
export interface GraphPolicy { id: string; name: string; tableId: string; command?: string }
export interface GraphDatabase { tables: GraphTable[]; policies: GraphPolicy[] }
export interface GraphDependency { id: string; name: string; version: string | null }
export interface GraphDiagnostic { id: string; level: 'error' | 'warning' | 'info'; message: string; path?: string }
/** Read-only provenance stamped into generated source for editable runtime nodes. */
export interface GraphEditableEntity {
  id: string;
  path: string;
  tagName: string;
  table: string | null;
  rowId: string | null;
  field: string | null;
  bindingId: string | null;
  sectionId: string | null;
  componentType: string | null;
  componentInstanceId: string | null;
  registryKey: string | null;
  elementRole: string | null;
  intent: string | null;
  targetPath: string | null;
}
export interface GraphEdge {
  from: string;
  to: string;
  kind: 'has_route' | 'uses' | 'instance_of' | 'implements' | 'emits' | 'binds' | 'resolves_to' | 'requires' | 'reads_from' | 'writes_to' | 'has_policy' | 'renders' | 'data_from' | 'field_from' | 'owned_by' | 'navigates_to';
}

/** Approved, read-only backend metadata supplied by a project-scoped inspector. */
export interface SystemGraphSchemaInput {
  tables?: Array<{
    name: string;
    columns?: Array<{ name: string; type?: string; nullable?: boolean }>;
    policies?: Array<{ name: string; command?: string }>;
  }>;
}
export interface SystemGraphBackendActionInput {
  name: string;
  capability?: string;
  readsFrom?: string[];
  writesTo?: string[];
}
export interface SystemGraphInput {
  files: Record<string, string>;
  /** Canonical page identities supplied by an in-flight App Builder candidate. */
  pageIdentities?: readonly SystemGraphPageIdentity[];
  revisionId?: string | null;
  snapshot?: Pick<SiteBundleSnapshot, 'snapshotId' | 'pageRegistry' | 'bindings' | 'businessSystem'> | null;
  runtimeManifest?: Pick<RuntimeManifest, 'routes' | 'dependencies'> | null;
  schema?: SystemGraphSchemaInput | null;
  backendActions?: SystemGraphBackendActionInput[];
  diagnostics?: GraphDiagnostic[];
}
export interface SystemGraph {
  revision: GraphRevisionIdentity;
  pages: GraphPage[];
  routes: GraphRoute[];
  components: GraphComponent[];
  sections: GraphSection[];
  intents: GraphIntent[];
  bindings: GraphBinding[];
  capabilities: GraphCapability[];
  backendActions: GraphBackendAction[];
  database: GraphDatabase;
  dependencies: GraphDependency[];
  diagnostics: GraphDiagnostic[];
  entities: GraphEditableEntity[];
  edges: GraphEdge[];
  /** Alternate addresses mapped to canonical graph node IDs. */
  aliases: Record<string, string>;
  /** Compatibility summary for existing UI consumers. */
  intentCount: number;
}

const SECTION_RE = /<(section|nav|header|footer)\b([^>]*)>/g;
const INTENT_RE = /<([A-Za-z][\w.]*)\b([^<>]*?data-ut-intent=["']([^"']+)["'][^<>]*?)>([^<]{0,80})/g;
const TARGET_RE = /data-ut-(?:target-page-id|path|target)=["']([^"']+)["']|\bhref=["']([^"']+)["']|\bto=["']([^"']+)["']/;
const IMPORT_RE = /import\s+(?:([\w$]+)|\{([^}]+)\})\s+from\s+["']([^"']+)["']/g;
const ATTR = (attrs: string, name: string) => new RegExp(`${name}=["']([^"']+)["']`).exec(attrs)?.[1];
const EDITABLE_ENTITY_RE = /<([A-Za-z][\w.]*)\b([^>]*(?:data-ut-(?:source-table|row-id|field|binding-id|entity-id|component-type|component-id|component-instance-id|registry-key|role|intent|path)|\b(?:href|to)=)[^>]*)>/g;

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function asInput(input: Record<string, string> | SystemGraphInput): SystemGraphInput {
  return 'files' in input && typeof (input as SystemGraphInput).files === 'object'
    ? input as SystemGraphInput
    : { files: input as Record<string, string> };
}

function fallbackRoute(path: string): string {
  const name = path.split('/').pop()?.replace(/\.(?:t|j)sx$/, '') ?? '';
  return /^(home|index)$/i.test(name) ? '/' : `/${name.toLowerCase()}`;
}

function pageIdForPath(
  pages: readonly { id: string; path: string; filePath?: string }[],
  filePath: string,
): string {
  return pages.find((page) => page.filePath === filePath)?.id ?? `page:${filePath}`;
}

function intentsIn(source: string): GraphIntent[] {
  const intents: GraphIntent[] = [];
  for (const match of source.matchAll(INTENT_RE)) {
    const target = TARGET_RE.exec(match[2]);
    const intent = match[3];
    intents.push({
      id: `intent:${intent}`,
      intent,
      label: (match[4] || ATTR(match[2], 'aria-label') || '').trim().slice(0, 80),
      target: target ? (target[1] ?? target[2] ?? target[3]) : null,
    });
  }
  return intents;
}

function resolveImportedFile(importerPath: string, specifier: string, files: Record<string, string>): string | null {
  const rawBase = specifier.startsWith('@/')
    ? `/src/${specifier.slice(2)}`
    : specifier.startsWith('.')
      ? [...importerPath.split('/').slice(0, -1), ...specifier.split('/')].reduce<string[]>((parts, segment) => {
          if (!segment || segment === '.') return parts;
          if (segment === '..') parts.pop();
          else parts.push(segment);
          return parts;
        }, []).join('/')
      : '';
  if (!rawBase) return null;
  const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const candidates = [base, ...['.tsx', '.ts', '.jsx', '.js'].map((extension) => `${base}${extension}`),
    ...['index.tsx', 'index.ts', 'index.jsx', 'index.js'].map((name) => `${base}/${name}`)];
  return candidates.find((candidate) => candidate in files) ?? null;
}

function componentImports(source: string, importerPath: string, files: Record<string, string>): Array<{ name: string; aliases: string[]; sourcePath: string | null }> {
  const imports: Array<{ name: string; aliases: string[]; sourcePath: string | null }> = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[3];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const sourcePath = resolveImportedFile(importerPath, specifier, files);
    const moduleName = specifier.split('/').pop()?.replace(/\.(?:t|j)sx?$/, '') ?? '';
    if (match[1]) {
      imports.push({ name: moduleName || match[1], aliases: moduleName && moduleName !== match[1] ? [match[1]] : [], sourcePath });
      continue;
    }
    for (const entry of (match[2] ?? '').split(',').map((name) => name.trim()).filter(Boolean)) {
      const [name, alias] = entry.split(/\s+as\s+/i).map((part) => part.trim());
      imports.push({ name, aliases: alias && alias !== name ? [alias] : [], sourcePath });
    }
  }
  return imports;
}

function fallbackEditableEntityId(
  path: string,
  tagName: string,
  identityParts: Array<string | null>,
  occurrence: number,
): string {
  const stableParts = identityParts.filter((part): part is string => Boolean(part));
  const identity = stableParts.length ? stableParts.join('\0') : tagName;
  return `entity:${encodeURIComponent(path)}:${fnv1a(`${tagName}\0${identity}`)}:${occurrence}`;
}

function snapshotPages(snapshot: SystemGraphInput['snapshot']): SystemGraphPageIdentity[] {
  const pages = snapshot?.pageRegistry?.pages ?? {};
  return Object.values(pages).map((page) => ({
    id: String(page.pageId), path: String(page.path || '/'), filePath: page.filePath,
    title: page.title, role: page.pageRole ?? page.pageType,
  }));
}

function packageDependencies(files: Record<string, string>): Record<string, string> {
  try {
    const pkg = JSON.parse(files['/package.json'] ?? '{}') as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  } catch { return {}; }
}

/** Build a full graph only from canonical/reviewed inputs; no I/O or mutation. */
export function buildSystemGraph(input: Record<string, string> | SystemGraphInput): SystemGraph {
  const context = asInput(input);
  const files = context.files;
  const snapshotPageRecords = context.pageIdentities?.length
    ? context.pageIdentities
    : snapshotPages(context.snapshot);
  const routeByFile = new Map(snapshotPageRecords.filter((page) => page.filePath).map((page) => [page.filePath!, page.path]));
  const pages: GraphPage[] = [];
  const components = new Map<string, GraphComponent>();
  const allIntents = new Map<string, GraphIntent>();
  const entities: GraphEditableEntity[] = [];

  for (const path of Object.keys(files).sort()) {
    if (!/^\/src\/pages\/.+\.(t|j)sx$/.test(path)) continue;
    const source = files[path] ?? '';
    const entityOccurrences = new Map<string, number>();
    for (const match of source.matchAll(EDITABLE_ENTITY_RE)) {
      const attrs = match[2];
      const table = ATTR(attrs, 'data-ut-source-table') ?? null;
      const rowId = ATTR(attrs, 'data-ut-row-id') ?? null;
      const field = ATTR(attrs, 'data-ut-field') ?? null;
      const bindingId = ATTR(attrs, 'data-ut-binding-id') ?? null;
      const sectionId = ATTR(attrs, 'data-ut-section-id') ?? null;
      const explicitId = ATTR(attrs, 'data-ut-entity-id');
      const componentType = ATTR(attrs, 'data-ut-component-type') ?? null;
      const componentInstanceId = ATTR(attrs, 'data-ut-component-id') ?? ATTR(attrs, 'data-ut-component-instance-id') ?? null;
      const registryKey = ATTR(attrs, 'data-ut-registry-key') ?? null;
      const elementRole = ATTR(attrs, 'data-ut-role') ?? null;
      const intent = ATTR(attrs, 'data-ut-intent') ?? null;
      const targetPath = ATTR(attrs, 'data-ut-path') ?? ATTR(attrs, 'href') ?? ATTR(attrs, 'to') ?? null;
      const entityIdentity = [table, rowId, field, bindingId, sectionId, componentType, componentInstanceId, registryKey, elementRole, intent, targetPath];
      const fallbackKey = `${match[1]}\0${entityIdentity.filter(Boolean).join('\0')}`;
      const occurrence = entityOccurrences.get(fallbackKey) ?? 0;
      entityOccurrences.set(fallbackKey, occurrence + 1);
      entities.push({
        id: explicitId ?? fallbackEditableEntityId(path, match[1], entityIdentity, occurrence),
        path, tagName: match[1], table, rowId, field, bindingId, sectionId,
        componentType, componentInstanceId, registryKey, elementRole, intent, targetPath,
      });
    }
    const starts = [...source.matchAll(SECTION_RE)];
    const sections = starts.map((match, index) => {
      const end = starts[index + 1]?.index ?? source.length;
      const localId = ATTR(match[2], 'data-ut-section-id') ?? ATTR(match[2], 'id') ?? ATTR(match[2], 'aria-label') ?? `section-${index + 1}`;
      return { id: localId, nodeId: `section:${pageIdForPath(snapshotPageRecords, path)}:${localId}`, intents: intentsIn(source.slice(match.index ?? 0, end)) };
    });
    const intents = intentsIn(source);
    intents.forEach((intent) => allIntents.set(intent.id, intent));
    const pageId = pageIdForPath(snapshotPageRecords, path);
    const componentIds = componentImports(source, path, files).map(({ name, aliases, sourcePath }) => {
      const id = `component:${name}`;
      const existing = components.get(id) ?? { id, name, aliases: [], sourcePath, usedByPageIds: [] };
      existing.aliases = [...new Set([...existing.aliases, ...aliases])];
      existing.sourcePath = existing.sourcePath ?? sourcePath;
      if (!existing.usedByPageIds.includes(pageId)) existing.usedByPageIds.push(pageId);
      components.set(id, existing);
      return id;
    });
    pages.push({ id: pageId, path, name: path.split('/').pop()!.replace(/\.(t|j)sx$/, ''), route: routeByFile.get(path) ?? fallbackRoute(path), sections, intents, componentIds: [...new Set(componentIds)].sort() });
  }

  for (const record of snapshotPageRecords) {
    if (!pages.some((page) => page.id === record.id)) pages.push({ id: record.id, path: record.filePath ?? '', name: record.id, route: record.path, sections: [], intents: [], componentIds: [] });
  }
  pages.sort((left, right) => left.route.localeCompare(right.route) || left.id.localeCompare(right.id));

  const routePaths = new Set([...(context.runtimeManifest?.routes ?? []), ...snapshotPageRecords.map((page) => page.path), ...pages.map((page) => page.route)]);
  const routes = [...routePaths].filter(Boolean).sort().map((path) => {
    const page = pages.find((candidate) => candidate.route === path);
    const source = page?.path ? files[page.path] ?? '' : '';
    return { id: `route:${path}`, path, pageId: page?.id ?? null, requiresAuth: /(?:RequireAuth|ProtectedRoute|auth\.getUser|useAuth)/.test(source) };
  });

  const bindings: GraphBinding[] = Object.values(context.snapshot?.bindings ?? {}).map((binding) => {
    const intent = binding.coreIntent ?? binding.intent ?? 'unknown';
    const page = pages.find((candidate) => candidate.id === binding.sourcePageId);
    allIntents.set(`intent:${intent}`, allIntents.get(`intent:${intent}`) ?? { id: `intent:${intent}`, intent, label: binding.sourceLabel ?? '', target: binding.targetId ?? null });
    return { id: `binding:${binding.bindingId}`, intentId: `intent:${intent}`, pageId: page?.id ?? null, target: binding.targetId ?? null };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const capabilities = (context.snapshot?.businessSystem?.capabilities ?? []).map((capability) => ({ id: `capability:${capability.id}`, capability: capability.id, status: capability.status ?? null })).sort((left, right) => left.id.localeCompare(right.id));
  const capabilityIds = new Set(capabilities.map((capability) => capability.id));
  const database: GraphDatabase = { tables: [], policies: [] };
  for (const table of context.schema?.tables ?? []) {
    const tableId = `table:${table.name}`;
    const policies = (table.policies ?? []).map((policy) => ({ id: `policy:${table.name}:${policy.name}`, name: policy.name, tableId, command: policy.command }));
    database.tables.push({ id: tableId, name: table.name, columns: (table.columns ?? []).map((column) => ({ id: `column:${table.name}.${column.name}`, ...column })), policyIds: policies.map((policy) => policy.id) });
    database.policies.push(...policies);
  }
  database.tables.sort((left, right) => left.id.localeCompare(right.id));
  database.policies.sort((left, right) => left.id.localeCompare(right.id));

  const backendActions = (context.backendActions ?? []).map((action) => ({
    id: `action:${action.name}`,
    name: action.name,
    capabilityId: action.capability ? `capability:${action.capability}` : null,
    readTableIds: [...new Set(action.readsFrom ?? [])].map((table) => `table:${table}`),
    writtenTableIds: [...new Set(action.writesTo ?? [])].map((table) => `table:${table}`),
    tableIds: [...new Set([...(action.readsFrom ?? []), ...(action.writesTo ?? [])])].map((table) => `table:${table}`),
  })).sort((left, right) => left.id.localeCompare(right.id));
  const dependencies = Object.entries({ ...packageDependencies(files), ...(context.runtimeManifest?.dependencies ?? {}) }).map(([name, version]) => ({ id: `dependency:${name}`, name, version: version || null })).sort((left, right) => left.id.localeCompare(right.id));

  const aliases: Record<string, string> = {};
  const registerAlias = (alias: string, canonicalId: string) => {
    if (alias && alias !== canonicalId && !(alias in aliases)) aliases[alias] = canonicalId;
  };
  pages.forEach((page) => {
    registerAlias(`page:${page.route}`, page.id);
    registerAlias(`page:${page.name}`, page.id);
    const pageIdentity = snapshotPageRecords.find((record) => record.id === page.id);
    const role = pageIdentity?.role;
    const title = pageIdentity?.title;
    for (const value of [role, title]) {
      if (!value) continue;
      const aliasesForRole = listTopologyPageRoleAliases(value);
      for (const alias of aliasesForRole) registerAlias(`page:${alias}`, page.id);
      registerAlias(`page:${value}`, page.id);
    }
    for (const section of page.sections) {
      registerAlias(`section:${page.route}#${section.id}`, section.nodeId);
      registerAlias(`section:${page.id}#${section.id}`, section.nodeId);
    }
    for (const intent of page.intents) {
      registerAlias(`button:${page.route}#${intent.intent}`, intent.id);
      if (intent.label) registerAlias(`button:${page.route}#${intent.label}`, intent.id);
    }
  });
  components.forEach((component) => {
    for (const alias of component.aliases) registerAlias(`component:${alias}`, component.id);
    if (component.sourcePath) {
      const moduleName = component.sourcePath.split('/').pop()?.replace(/\.(?:t|j)sx?$/i, '');
      if (moduleName) registerAlias(`component:${moduleName}`, component.id);
    }
  });

  const edges: GraphEdge[] = [];
  pages.forEach((page) => {
    const route = routes.find((candidate) => candidate.pageId === page.id);
    if (route) edges.push({ from: page.id, to: route.id, kind: 'has_route' });
    page.componentIds.forEach((componentId) => edges.push({ from: page.id, to: componentId, kind: 'uses' }));
    page.intents.forEach((intent) => edges.push({ from: page.id, to: intent.id, kind: 'emits' }));
  });
  bindings.forEach((binding) => {
    if (binding.pageId) edges.push({ from: binding.pageId, to: binding.id, kind: 'binds' });
    edges.push({ from: binding.id, to: binding.intentId, kind: 'resolves_to' });
  });
  entities.forEach((entity) => {
    const page = pages.find((candidate) => candidate.path === entity.path);
    if (page) edges.push({ from: page.id, to: entity.id, kind: 'renders' });
    if (entity.componentType) {
      const componentId = `component:${entity.componentType}`;
      const existing = components.get(componentId) ?? {
        id: componentId,
        name: entity.componentType,
        aliases: [],
        sourcePath: null,
        usedByPageIds: [],
      };
      if (page && !existing.usedByPageIds.includes(page.id)) existing.usedByPageIds.push(page.id);
      components.set(componentId, existing);
      edges.push({ from: entity.id, to: componentId, kind: 'instance_of' });
    }
    if (entity.registryKey) edges.push({ from: entity.id, to: `registry:${entity.registryKey}`, kind: 'implements' });
    if (entity.table) {
      const tableId = `table:${entity.table}`;
      edges.push({ from: entity.id, to: tableId, kind: 'data_from' });
      if (entity.field) edges.push({ from: entity.id, to: `column:${entity.table}.${entity.field}`, kind: 'field_from' });
    }
    if (entity.bindingId) edges.push({ from: entity.id, to: `binding:${entity.bindingId}`, kind: 'owned_by' });
    if (entity.intent) {
      const intentId = `intent:${entity.intent}`;
      allIntents.set(intentId, allIntents.get(intentId) ?? { id: intentId, intent: entity.intent, label: entity.elementRole ?? '', target: entity.targetPath });
      edges.push({ from: entity.id, to: intentId, kind: 'emits' });
    }
    if (entity.targetPath) edges.push({ from: entity.id, to: `route:${entity.targetPath}`, kind: 'navigates_to' });
  });
  backendActions.forEach((action) => {
    if (action.capabilityId && capabilityIds.has(action.capabilityId)) edges.push({ from: action.id, to: action.capabilityId, kind: 'requires' });
    action.readTableIds.forEach((tableId) => edges.push({ from: action.id, to: tableId, kind: 'reads_from' }));
    action.writtenTableIds.forEach((tableId) => edges.push({ from: action.id, to: tableId, kind: 'writes_to' }));
  });
  database.policies.forEach((policy) => edges.push({ from: policy.tableId, to: policy.id, kind: 'has_policy' }));

  const contentHash = fnv1a(Object.keys(files).sort().map((path) => `${path}\0${files[path]}`).join('\0'));
  const revision = context.revisionId
    ? { id: context.revisionId, source: 'canonical-revision' as const, contentHash }
    : context.snapshot?.snapshotId
      ? { id: context.snapshot.snapshotId, source: 'snapshot' as const, contentHash }
      : { id: `files:${contentHash}`, source: 'files' as const, contentHash };

  return {
    revision, pages, routes,
    components: [...components.values()].map((component) => ({ ...component, usedByPageIds: component.usedByPageIds.sort() })).sort((left, right) => left.id.localeCompare(right.id)),
    sections: pages.flatMap((page) => page.sections),
    intents: [...allIntents.values()].sort((left, right) => left.id.localeCompare(right.id)),
    bindings, capabilities, backendActions, database, dependencies,
    diagnostics: [...(context.diagnostics ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    entities: entities.sort((left, right) => left.id.localeCompare(right.id)),
    edges,
    aliases,
    intentCount: pages.reduce((count, page) => count + page.intents.length, 0),
  };
}

/** Compact graph context for the AI. Callers use inspection operations for deeper slices. */
export function renderSystemGraphForPrompt(graph: SystemGraph, maxChars = 3000): string {
  if (graph.pages.length === 0) return '';
  const lines = [`SYSTEM GRAPH revision=${graph.revision.id} (read-only):`];
  for (const page of graph.pages) {
    lines.push(`- ${page.name} ${page.route} (${page.sections.length} sections, ${page.componentIds.length} components)`);
    for (const intent of page.intents.slice(0, 8)) lines.push(`    • "${intent.label || intent.intent}" → ${intent.intent}${intent.target ? ` → ${intent.target}` : ''}`);
  }
  if (graph.capabilities.length) lines.push(`Capabilities: ${graph.capabilities.map((capability) => capability.capability).join(', ')}`);
  if (graph.diagnostics.length) lines.push(`Diagnostics: ${graph.diagnostics.slice(0, 3).map((diagnostic) => diagnostic.message).join(' | ')}`);
  const text = lines.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}

export function findGraphNode(graph: SystemGraph, id: string): unknown | null {
  const collections: unknown[][] = [graph.pages, graph.routes, graph.components, graph.sections, graph.intents, graph.bindings, graph.capabilities, graph.backendActions, graph.database.tables, graph.database.policies, graph.dependencies, graph.diagnostics, graph.entities];
  for (const collection of collections) {
    const match = collection.find((node) => {
      const entity = node as { id?: string; nodeId?: string };
      return entity.id === id || entity.nodeId === id;
    });
    if (match) return match;
  }
  return null;
}

export function graphEdgesFor(graph: SystemGraph, id: string): GraphEdge[] {
  return graph.edges.filter((edge) => edge.from === id || edge.to === id);
}
