/**
 * Enforced dispatch over the existing `agentOperations` registry. Preflight
 * only: identity, property ownership, source scope and canonical vocabulary
 * are checked before an operation runs; results stay proposals or
 * ResourceRuntime writes. No new tool names, writer or persistence.
 */
import { agentOperations, type AgentContext, type AgentOperationName } from '@/services/agent-runtime/operations';
import { isCoreIntent } from '@/platform/core/coreIntents';
import type { UnisonBuilderTurnContext } from '@/types/unisonBuilderConnector';

type Ops = typeof agentOperations;
type OpArgs<N extends AgentOperationName> = Ops[N] extends (ctx: AgentContext, ...args: infer A) => unknown ? A : never;
type OpResult<N extends AgentOperationName> = Ops[N] extends (...args: never[]) => infer R ? R : never;

const RESOURCE_OPS = new Set<AgentOperationName>(['read_resource', 'update_resource_field']);
const FILE_ARG_OPS = new Set<AgentOperationName>(['inspect_file', 'swap_image']);
const ROUTER_FILE = '/src/App.tsx';
const THEME_FILE = '/src/index.css';
const FONT_ALIASES = ['--font-display', '--font-sans'];

export class BuilderToolRefusal extends Error {
  constructor(public readonly operation: AgentOperationName, message: string) {
    super(message);
    this.name = 'BuilderToolRefusal';
  }
}

/** Strip a trailing `#field` so a record mark matches any of its fields. */
const recordOf = (mark: string) => mark.split('#')[0];

export function preflightBuilderOperation<N extends AgentOperationName>(
  context: UnisonBuilderTurnContext,
  agentCtx: AgentContext,
  name: N,
  args: OpArgs<N>,
): void {
  const refuse = (msg: string) => { throw new BuilderToolRefusal(name, msg); };
  if (!(name in agentOperations)) refuse(`Unknown Builder operation: ${String(name)}`);
  const { projectId, businessId, revisionId } = context.identity;
  if (projectId && agentCtx.projectId && projectId !== agentCtx.projectId) refuse('Operation context belongs to another project.');
  if (businessId && agentCtx.businessId && businessId !== agentCtx.businessId) refuse('Operation context belongs to another business.');
  if (revisionId && agentCtx.revisionId && revisionId !== agentCtx.revisionId) refuse('Operation context is from an older revision. Reload before editing.');

  const a = args as unknown[];
  if (FILE_ARG_OPS.has(name)) {
    const path = String(a[0] ?? '');
    if (path === ROUTER_FILE && name !== 'inspect_file') refuse('PageRegistry alone authors /src/App.tsx.');
    if (name !== 'inspect_file' && context.sourceTargets.length && !context.sourceTargets.includes(path)) {
      refuse(`${path} is outside this request's source targets.`);
    }
  }

  if (RESOURCE_OPS.has(name)) {
    const mark = String(a[0] ?? '');
    const selected = context.element?.resourceMark;
    if (selected && recordOf(selected) !== recordOf(mark)) {
      refuse('That record is not the one behind the selected element. Re-select it before editing.');
    }
    if (name === 'update_resource_field' && context.element && context.element.ownerKind !== 'resource') {
      refuse('The selected element is not backed by a saved record; edit it as page content instead.');
    }
  }

  if (name === 'propose_bind_intent') {
    const intent = String(a[1] ?? '');
    if (!isCoreIntent(intent)) refuse(`Unknown canonical intent: ${intent}`);
    const payload = a[2];
    if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) refuse('Intent payload must be an object.');
  }

  if (name === 'set_theme_tokens') {
    const allowed = new Set([...context.designSystem.tokenNames, ...FONT_ALIASES]);
    for (const key of Object.keys((a[0] ?? {}) as Record<string, string>)) {
      const token = key.startsWith('--') ? key : `--${key}`;
      if (!allowed.has(token)) refuse(`${token} is not a canonical design token role.`);
    }
  }
}

/** Proposed files must stay inside the request's scope; the router is never AI-authored. */
export function assertProposalScope(context: UnisonBuilderTurnContext, name: AgentOperationName, result: unknown): void {
  const files = (result as { files?: Record<string, string>; change?: { files?: Record<string, string> } | null } | null);
  const paths = Object.keys(files?.files ?? files?.change?.files ?? {});
  for (const path of paths) {
    if (path === ROUTER_FILE) throw new BuilderToolRefusal(name, 'PageRegistry alone authors /src/App.tsx.');
    if (path === THEME_FILE && (name === 'set_theme_tokens' || name === 'set_font')) continue;
    // Catalog updates intentionally sync every page showing the old value.
    if (name === 'update_catalog_item') continue;
    if (context.sourceTargets.length && !context.sourceTargets.includes(path)) {
      throw new BuilderToolRefusal(name, `Proposal touches ${path}, outside this request's source targets.`);
    }
  }
}

export async function dispatchBuilderOperation<N extends AgentOperationName>(
  context: UnisonBuilderTurnContext,
  agentCtx: AgentContext,
  name: N,
  ...args: OpArgs<N>
): Promise<Awaited<OpResult<N>>> {
  preflightBuilderOperation(context, agentCtx, name, args);
  const op = agentOperations[name] as unknown as (ctx: AgentContext, ...rest: unknown[]) => unknown;
  const result = await op(agentCtx, ...(args as unknown[]));
  assertProposalScope(context, name, result);
  return result as Awaited<OpResult<N>>;
}
