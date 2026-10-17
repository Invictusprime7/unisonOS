import type {
  UnisonBuilderConnectorInput,
  UnisonBuilderTurnContext,
} from '@/types/unisonBuilderConnector';

// Canonical Unison token roles (values are always supplied by the project's sealed theme).
const TOKEN_NAMES = [
  '--background', '--foreground', '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground', '--accent', '--accent-foreground',
  '--muted', '--muted-foreground', '--card', '--card-foreground', '--border',
  '--destructive', '--destructive-foreground', '--ut-border-weight',
  '--ut-font-display', '--ut-font-body', '--ut-font-mono', '--ut-section-space',
  '--ut-density-gap', '--ut-density-padding', '--ut-radius-base',
  '--ut-motion-duration', '--ut-motion-ease', '--ut-motion-distance',
] as const;

/** Read-only, deterministic assembly; this connector has no database or VFS writer. */
export function createUnisonBuilderContext(input: UnisonBuilderConnectorInput): UnisonBuilderTurnContext {
  const selection = input.selection ?? null;
  if (selection?.projectId && input.projectId && selection.projectId !== input.projectId) {
    throw new Error('Selected element belongs to another project. Re-select it before editing.');
  }
  if (selection?.revisionId && input.revisionId && selection.revisionId !== input.revisionId) {
    throw new Error('Selected element belongs to an older revision. Re-select it before editing.');
  }
  const sourceTargets = [...new Set(input.sourceTargets ?? [])];
  for (const path of sourceTargets) {
    if (!path.startsWith('/src/') || path.split('/').includes('..')) {
      throw new Error(`Invalid Builder source target: ${path}`);
    }
    if (input.files && typeof input.files[path] !== 'string') {
      throw new Error(`Builder source target is missing: ${path}. Create new pages through page operations.`);
    }
  }
  const registry = input.registryContext ?? null;
  if (registry?.implementations.some(item => !['approved', 'portable'].includes(item.certification))) {
    throw new Error('Builder registry context contains an uncertified implementation. Resolve canonical eligibility before authoring.');
  }
  const descriptor = input.descriptor ?? null;
  const resourceMark = selection?.resourceMark ?? null;
  const filePath = selection?.componentPath ?? null;
  const ownerKind = descriptor?.ownerKind ?? (resourceMark || (selection?.sourceTable && selection.rowId)
    ? 'resource' : filePath ? 'source' : 'unbound');
  const catalogSummary = input.catalogSummary?.trim() || null;
  return {
    version: 'unison-builder-connector/v1',
    identity: { projectId: input.projectId ?? null, businessId: input.businessId ?? null, revisionId: input.revisionId ?? null },
    request: input.requestEnvelope ?? null,
    element: selection ? { selection: { ...selection }, descriptor, ownerKind, filePath, resourceMark } : null,
    catalog: { summary: catalogSummary, authority: 'agentOperations/ResourceRuntime' },
    registry: {
      signature: registry?.designRegistrySignature ?? null,
      industry: registry?.industry ?? null,
      artDirectionPackId: registry?.artDirectionPackId ?? null,
      allowedImplementationIds: registry?.implementations.map(item => item.id) ?? [],
      projection: registry,
    },
    designSystem: {
      tokenNames: TOKEN_NAMES, preserveSealedArtDirection: true,
      existingFiles: 'explicit-hunks', newFiles: 'complete-source', routerAuthority: 'PageRegistry',
    },
    sourceTargets,
    unavailable: [
      ...(!selection ? ['element' as const] : []),
      ...(!catalogSummary ? ['catalog' as const] : []),
      ...(!registry ? ['registry' as const] : []),
    ],
  };
}

/** Compact guidance rides existing request contracts; no new edge endpoint or duplicated sources. */
export function renderUnisonBuilderDirective(context: UnisonBuilderTurnContext): string {
  return [
    '[UNISON BUILDER CONNECTOR v1]',
    `Identity: ${JSON.stringify(context.identity)}`,
    `Source targets: ${context.sourceTargets.join(', ') || 'not resolved'}`,
    context.element ? `Selected property owner: ${JSON.stringify(context.element)}` : '',
    `Existing files require explicit necessary hunks; complete source is allowed only for new files. PageRegistry alone authors /src/App.tsx.`,
    'Saved catalog/content values must use agentOperations through ResourceRuntime; presentation edits preserve record marks, bindings and button destinations.',
    `Canonical implementations: ${context.registry.allowedImplementationIds.join(', ') || 'not resolved; do not invent certification'}`,
    `Sealed Art Direction: ${context.registry.artDirectionPackId ?? 'not supplied; preserve existing theme'}`,
    `Design token roles: ${context.designSystem.tokenNames.join(', ')}`,
    'Capability and binding validation remain mandatory; missing business capability readiness blocks publishing, not a safe preview draft.',
    context.catalog.summary ? `Connected catalog context:\n${context.catalog.summary}` : '',
    `Unavailable context: ${context.unavailable.join(', ') || 'none'}. Missing context is not proof of permission or readiness.`,
  ].filter(Boolean).join('\n');
}