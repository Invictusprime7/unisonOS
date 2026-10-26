import type { EditScope } from '@/services/editScopeResolver';

/**
 * P3 — intent-based AI editing.
 *
 * Normalizes a Builder prompt plus its resolved selection into one explicit
 * contract, then checks a proposed change against it before `commitMutation`.
 * New custom TSX files and npm dependencies are allowed when declared and
 * scoped; cross-page or backend changes require explicit consent.
 */
export type EditIntentScope = 'node' | 'section' | 'page' | 'site';
export type EditIntentOperation = 'text' | 'style' | 'replace' | 'insert' | 'restructure';

export interface EditIntentContract {
  editScope: EditIntentScope;
  operation: EditIntentOperation;
  /** Existing files the change may modify. New files under `/src/components/` are also allowed. */
  allowedPaths: string[];
  /** `data-ut-intent` bindings that must survive the change. */
  requiredBindings: string[];
  expectedRevisionId: string | null;
  dependencyPlan: { newFiles: 'scoped-components'; packages: 'declared-only' };
  consent: { crossPage: boolean; backend: boolean };
}

const OPERATION_PATTERNS: Array<[EditIntentOperation, RegExp]> = [
  ['restructure', /\b(restructure|reorganize|rearrange|redesign|rebuild|move|reorder|layout)\b/i],
  ['insert', /\b(add|insert|create|new|include|append)\b/i],
  ['replace', /\b(replace|swap|change (?:the )?(?:image|photo|picture|icon)|use (?:a|an|this) )\b/i],
  ['style', /\b(color|colour|font|bigger|smaller|bold|spacing|padding|margin|align|darker|lighter|style|background)\b/i],
  ['text', /\b(text|copy|wording|headline|title|rename|reword|say|says|label)\b/i],
];
const SITE_PATTERN = /\b(every page|all pages|whole site|entire site|site-?wide|across the site|everywhere)\b/i;
const BACKEND_PATTERN = /\b(database|table|backend|payment|stripe|checkout|booking system|email|login|sign[- ]?in|auth|cms|records?)\b/i;

export function classifyEditOperation(prompt: string): EditIntentOperation {
  for (const [operation, pattern] of OPERATION_PATTERNS) if (pattern.test(prompt)) return operation;
  return 'replace';
}

export function normalizeEditIntent(input: {
  prompt: string;
  scope?: EditScope | null;
  pagePath?: string | null;
  sharedPaths?: readonly string[];
  expectedRevisionId?: string | null;
  consent?: Partial<EditIntentContract['consent']>;
}): EditIntentContract {
  const site = SITE_PATTERN.test(input.prompt) || input.scope?.scopeType === 'site';
  const editScope: EditIntentScope = site ? 'site'
    : input.scope?.scopeType === 'section' || input.scope?.scopeType === 'block' ? 'section'
      : input.scope?.scopeType === 'element' ? 'node'
        : 'page';
  const owner = input.scope?.componentPath ?? input.pagePath ?? null;
  const allowedPaths = site ? [] : [...new Set([owner, input.pagePath, ...(input.sharedPaths ?? [])].filter((p): p is string => !!p))];
  return {
    editScope,
    operation: classifyEditOperation(input.prompt),
    allowedPaths,
    requiredBindings: [...(input.scope?.lockedBindings ?? [])].sort(),
    expectedRevisionId: input.expectedRevisionId ?? null,
    dependencyPlan: { newFiles: 'scoped-components', packages: 'declared-only' },
    consent: { crossPage: input.consent?.crossPage === true, backend: input.consent?.backend === true },
  };
}

/** True when the prompt itself asks for backend/business-data work. */
export function promptTouchesBackend(prompt: string): boolean {
  return BACKEND_PATTERN.test(prompt);
}

export type EditIntentViolation =
  | { code: 'stale-revision'; expected: string; actual: string | null }
  | { code: 'cross-page-consent'; paths: string[] }
  | { code: 'backend-consent'; paths: string[] }
  | { code: 'binding-removed'; bindings: string[] }
  | { code: 'undeclared-package'; packages: string[] };

export function checkEditAgainstIntent(contract: EditIntentContract, proposal: {
  baseRevisionId: string | null;
  files: Record<string, string | null>;
  previousFiles: Record<string, string>;
  declaredPackages?: readonly string[];
  installedPackages?: readonly string[];
}): EditIntentViolation[] {
  const violations: EditIntentViolation[] = [];
  if (contract.expectedRevisionId && proposal.baseRevisionId !== contract.expectedRevisionId) {
    violations.push({ code: 'stale-revision', expected: contract.expectedRevisionId, actual: proposal.baseRevisionId });
  }
  const paths = Object.keys(proposal.files);
  const backend = paths.filter((p) => p.startsWith('/supabase/') || p.startsWith('/src/integrations/'));
  if (backend.length && !contract.consent.backend) violations.push({ code: 'backend-consent', paths: backend });
  if (contract.editScope !== 'site' && !contract.consent.crossPage) {
    const outside = paths.filter((p) => !backend.includes(p) && !contract.allowedPaths.includes(p)
      && !(proposal.previousFiles[p] === undefined && p.startsWith('/src/components/')));
    if (outside.length) violations.push({ code: 'cross-page-consent', paths: outside });
  }
  const before = Object.values(proposal.previousFiles).join('\n');
  const after = Object.entries({ ...proposal.previousFiles, ...proposal.files })
    .filter(([, v]) => typeof v === 'string').map(([, v]) => v).join('\n');
  const removed = contract.requiredBindings.filter((b) => before.includes(`data-ut-intent="${b}"`) && !after.includes(`data-ut-intent="${b}"`));
  if (removed.length) violations.push({ code: 'binding-removed', bindings: removed });
  const known = new Set([...(proposal.declaredPackages ?? []), ...(proposal.installedPackages ?? [])]);
  const imported = new Set<string>();
  for (const src of Object.values(proposal.files)) {
    for (const m of (src ?? '').matchAll(/from\s+['"]([^'"./@][^'"]*|@[^'"/]+\/[^'"]+)['"]/g)) {
      const name = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0];
      if (!name.startsWith('@/')) imported.add(name);
    }
  }
  const undeclared = [...imported].filter((p) => !known.has(p)).sort();
  if (undeclared.length) violations.push({ code: 'undeclared-package', packages: undeclared });
  return violations;
}

const OTHER_PAGE_PATTERN = /\b(other pages?|(?:the |a |new )?(?:about|contact|services|menu|pricing|gallery|blog|team|faq|booking|shop) page|add (?:a )?(?:new )?page|nav(?:igation|bar)?|footer|header)\b/i;
/** Files the platform rewrites itself after every save; never counted as an AI scope breach. */
const PLATFORM_DERIVED = new Set(['/src/App.tsx', '/package.json', '/src/index.css']);

/**
 * Builds the contract for one Affinity request. Asking for something in the
 * prompt is the consent: naming other pages/shared chrome grants cross-page,
 * naming business data grants backend. Otherwise the edit stays on the
 * current page and the files it already imports.
 */
export function editIntentForRequest(input: {
  prompt: string;
  activePagePath: string;
  pageImports: readonly string[];
  selectionOwnerPath?: string | null;
  expectedRevisionId: string | null;
  structural?: boolean;
}): EditIntentContract {
  const contract = normalizeEditIntent({
    prompt: input.prompt,
    pagePath: input.activePagePath,
    sharedPaths: [...input.pageImports, ...(input.selectionOwnerPath ? [input.selectionOwnerPath] : []), ...PLATFORM_DERIVED],
    expectedRevisionId: input.expectedRevisionId,
    consent: {
      crossPage: input.structural === true || OTHER_PAGE_PATTERN.test(input.prompt),
      backend: promptTouchesBackend(input.prompt),
    },
  });
  return contract;
}
