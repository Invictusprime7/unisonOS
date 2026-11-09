/**
 * Build-stage authorship provenance (Native Authorship guide §3 A2).
 *
 * Records, per build, what each stage of prompt-first creation saw — counts,
 * paths, content hashes and provenance — so one run shows where original
 * authored modules are lost: before the AI was asked, in the AI's own output,
 * in normalization, at commit or in Preview. It never stores prompt text,
 * source, credentials or business values: only hashes, paths and counts.
 *
 * Recording is a no-op unless the diagnostic flag is on
 * (localStorage `unison:authorship-trace` = "1", or
 * `VITE_UNISON_AUTHORSHIP_TRACE=1`). Tests enable it explicitly.
 */

export const AUTHORSHIP_STAGES = [
  'launchPrompt',
  'resolvedIntent',
  'artDirectionCandidates',
  'chosenDirection',
  'designReferences',
  'authorSiteInvocation',
  'rawCandidateFileManifest',
  'normalizedCandidateFileManifest',
  'validationResult',
  'acceptedVfsManifest',
  'previewRouteManifest',
] as const;
export type AuthorshipStage = typeof AUTHORSHIP_STAGES[number];

export type SourceProvenance = 'authored' | 'adapted' | 'certified' | 'chrome' | 'page' | 'system';

export interface ManifestEntry {
  path: string;
  hash: string;
  bytes: number;
  provenance: SourceProvenance;
  /** Authored/adapted modules this page file imports (pages only). */
  imports?: string[];
}

export interface AuthorshipTraceEvent {
  stage: AuthorshipStage;
  buildId: string;
  at: number;
  pageId?: string;
  revisionId?: string | null;
  counts: Record<string, number>;
  manifest?: ManifestEntry[];
  /** Hashes of requirement IDs/prompt parts present at this stage (never their text). */
  requirementHashes?: string[];
  rejections?: string[];
  detail?: Record<string, string | number | boolean | null>;
}

export type LossBoundary =
  | 'before-model-invocation'
  | 'model-output'
  | 'normalization'
  | 'commit'
  | 'preview'
  | 'none'
  | 'unknown';

export interface LossReport {
  boundary: LossBoundary;
  detail: string;
  authoredAtRaw: string[];
  authoredAccepted: string[];
}

const MAX_EVENTS = 400;

/** Small stable content hash (FNV-1a 32-bit + length); not a security hash. */
export function traceHash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}:${value.length}`;
}

let forcedEnabled: boolean | null = null;

/** Tests and diagnostics may force the flag; null restores flag detection. */
export function setAuthorshipTraceEnabled(enabled: boolean | null): void {
  forcedEnabled = enabled;
}

export function authorshipTraceEnabled(): boolean {
  if (forcedEnabled !== null) return forcedEnabled;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('unison:authorship-trace') === '1') return true;
  } catch { /* storage unavailable */ }
  try {
    return (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_UNISON_AUTHORSHIP_TRACE === '1';
  } catch {
    return false;
  }
}

const AUTHORED_PREFIX = /^\/src\/(?:project-components|components\/generated)\//;
const CHROME_FILE = /^\/src\/project-components\/site\/|\/Site(?:Nav|Navbar|Footer)\.[jt]sx?$/;
const DERIVATIVE_MARK = /@unison-derived-from\b|@unison-adapted\b/;

export function classifySource(path: string, content = ''): SourceProvenance {
  if (path.startsWith('/src/unison/design-sources/')) return 'certified';
  if (AUTHORED_PREFIX.test(path)) {
    if (CHROME_FILE.test(path)) return 'chrome';
    return DERIVATIVE_MARK.test(content) ? 'adapted' : 'authored';
  }
  if (path.startsWith('/src/pages/')) return 'page';
  return 'system';
}

function resolveImport(fromPath: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = `/src/${specifier.slice(2)}`;
  else if (specifier.startsWith('.')) {
    const parts = fromPath.split('/').slice(0, -1);
    for (const segment of specifier.split('/')) {
      if (segment === '..') parts.pop();
      else if (segment !== '.') parts.push(segment);
    }
    base = parts.join('/');
  } else return null;
  return base.replace(/\.(?:tsx?|jsx?)$/, '');
}

/**
 * Manifest of the source that matters for authorship: pages and site-local
 * modules (certified design-source files are counted, not listed).
 */
export function manifestFromFiles(files: Readonly<Record<string, string>>): { manifest: ManifestEntry[]; counts: Record<string, number> } {
  const counts: Record<string, number> = { authored: 0, adapted: 0, certified: 0, chrome: 0, page: 0 };
  const localModules = new Map<string, string>();
  for (const path of Object.keys(files)) {
    if (AUTHORED_PREFIX.test(path)) localModules.set(path.replace(/\.(?:tsx?|jsx?)$/, ''), path);
  }
  const manifest: ManifestEntry[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string' || !/\.(?:tsx?|jsx?)$/.test(path)) continue;
    const provenance = classifySource(path, content);
    if (provenance === 'system') continue;
    counts[provenance] = (counts[provenance] ?? 0) + 1;
    if (provenance === 'certified') continue;
    const entry: ManifestEntry = { path, hash: traceHash(content), bytes: content.length, provenance };
    if (provenance === 'page') {
      const imports = new Set<string>();
      for (const match of content.matchAll(/from\s+["']([^"']+)["']/g)) {
        const resolved = resolveImport(path, match[1]);
        const target = resolved ? localModules.get(resolved) ?? localModules.get(`${resolved}/index`) : undefined;
        if (target && ['authored', 'adapted'].includes(classifySource(target, files[target]))) imports.add(target);
      }
      if (imports.size) entry.imports = [...imports].sort();
    }
    manifest.push(entry);
  }
  manifest.sort((a, b) => a.path.localeCompare(b.path));
  return { manifest, counts };
}

export interface AuthorshipTrace {
  buildId: string;
  record(stage: AuthorshipStage, event?: Omit<AuthorshipTraceEvent, 'stage' | 'buildId' | 'at' | 'counts'> & { counts?: Record<string, number> }): void;
  recordFiles(stage: AuthorshipStage, files: Readonly<Record<string, string>>, extra?: Omit<AuthorshipTraceEvent, 'stage' | 'buildId' | 'at' | 'counts' | 'manifest'>): void;
  events(): AuthorshipTraceEvent[];
}

function createTrace(buildId: string): AuthorshipTrace {
  const events: AuthorshipTraceEvent[] = [];
  const push = (event: AuthorshipTraceEvent) => {
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    try {
      console.info('[authorship-trace]', JSON.stringify({ ...event, manifest: event.manifest?.map(({ path, hash, provenance, imports }) => ({ path, hash, provenance, imports })) }));
    } catch { /* logging is best-effort */ }
  };
  return {
    buildId,
    record(stage, event = {}) {
      push({ ...event, stage, buildId, at: Date.now(), counts: event.counts ?? {} });
    },
    recordFiles(stage, files, extra = {}) {
      const { manifest, counts } = manifestFromFiles(files);
      push({ ...extra, stage, buildId, at: Date.now(), counts, manifest });
    },
    events: () => [...events],
  };
}

const NOOP_TRACE: AuthorshipTrace = { buildId: 'off', record() {}, recordFiles() {}, events: () => [] };

let active: AuthorshipTrace = NOOP_TRACE;
const completed: AuthorshipTrace[] = [];

/** Start the trace for one build; returns the no-op trace when the flag is off. */
export function beginAuthorshipTrace(buildId: string): AuthorshipTrace {
  if (!authorshipTraceEnabled()) {
    active = NOOP_TRACE;
    return active;
  }
  active = createTrace(buildId);
  completed.push(active);
  if (completed.length > 5) completed.shift();
  try {
    (globalThis as { __unisonAuthorshipTraces?: () => AuthorshipTraceEvent[][] }).__unisonAuthorshipTraces = () => completed.map((trace) => trace.events());
  } catch { /* diagnostics only */ }
  return active;
}

/** The current build's trace (no-op when none or flag off). */
export function activeAuthorshipTrace(): AuthorshipTrace {
  return active;
}

export function endAuthorshipTrace(): void {
  active = NOOP_TRACE;
}

const localAuthored = (event?: AuthorshipTraceEvent) => new Set((event?.manifest ?? [])
  .filter((entry) => entry.provenance === 'authored' || entry.provenance === 'adapted')
  .map((entry) => entry.path));

const importedAuthored = (event?: AuthorshipTraceEvent) => new Set((event?.manifest ?? [])
  .flatMap((entry) => entry.provenance === 'page' ? entry.imports ?? [] : []));

/**
 * First boundary at which authored body modules are lost. Raw manifests are
 * merged across pages (each page turn records its own raw candidate).
 */
export function firstLossBoundary(events: readonly AuthorshipTraceEvent[]): LossReport {
  const last = (stage: AuthorshipStage) => [...events].reverse().find((event) => event.stage === stage);
  const invocations = events.filter((event) => event.stage === 'authorSiteInvocation');
  const launch = last('launchPrompt');
  const empty = { authoredAtRaw: [] as string[], authoredAccepted: [] as string[] };
  if (!invocations.length) {
    return { boundary: 'before-model-invocation', detail: 'No page authoring request was sent to the AI.', ...empty };
  }
  const required = new Set(launch?.requirementHashes ?? []);
  const missingContext = invocations.find((event) => {
    const seen = new Set(event.requirementHashes ?? []);
    return [...required].some((hash) => !seen.has(hash));
  });
  if (missingContext) {
    return { boundary: 'before-model-invocation', detail: `Creative requirements from the prompt were missing from the request for page ${missingContext.pageId ?? 'unknown'}.`, ...empty };
  }
  const raws = events.filter((event) => event.stage === 'rawCandidateFileManifest');
  const authoredAtRaw = new Set<string>();
  const importedAtRaw = new Set<string>();
  for (const raw of raws) {
    localAuthored(raw).forEach((path) => authoredAtRaw.add(path));
    importedAuthored(raw).forEach((path) => importedAtRaw.add(path));
  }
  if (!raws.length) return { boundary: 'model-output', detail: 'The AI returned no usable candidate.', ...empty };
  const rawUsed = [...authoredAtRaw].filter((path) => importedAtRaw.has(path));
  if (!rawUsed.length) {
    return { boundary: 'model-output', detail: authoredAtRaw.size ? 'The AI wrote site-local modules but no page imports them.' : 'The AI authored no original site-local body module.', authoredAtRaw: [...authoredAtRaw], authoredAccepted: [] };
  }
  const check = (stage: AuthorshipStage): string[] | null => {
    const event = last(stage);
    if (!event) return null;
    const present = localAuthored(event);
    const imported = importedAuthored(event);
    return rawUsed.filter((path) => !present.has(path) || !imported.has(path));
  };
  const normalizedLoss = check('normalizedCandidateFileManifest');
  if (normalizedLoss?.length) return { boundary: 'normalization', detail: `Lost during normalization: ${normalizedLoss.join(', ')}`, authoredAtRaw: [...authoredAtRaw], authoredAccepted: [] };
  const acceptedLoss = check('acceptedVfsManifest');
  if (acceptedLoss === null) {
    const validation = last('validationResult');
    return { boundary: validation?.detail?.ready === false ? 'normalization' : 'unknown',
      detail: validation?.detail?.ready === false ? `The candidate was rejected: ${(validation.rejections ?? []).slice(0, 3).join(' | ')}` : 'No accepted revision was recorded.',
      authoredAtRaw: [...authoredAtRaw], authoredAccepted: [] };
  }
  if (acceptedLoss.length) return { boundary: 'commit', detail: `Lost at commit: ${acceptedLoss.join(', ')}`, authoredAtRaw: [...authoredAtRaw], authoredAccepted: [] };
  const accepted = last('acceptedVfsManifest');
  const authoredAccepted = rawUsed.filter((path) => localAuthored(accepted).has(path));
  const preview = last('previewRouteManifest');
  if (preview) {
    const visiblePages = new Set(preview.manifest?.filter((entry) => entry.provenance === 'page').map((entry) => entry.path) ?? []);
    const visibleImports = new Set((accepted?.manifest ?? [])
      .filter((entry) => entry.provenance === 'page' && visiblePages.has(entry.path))
      .flatMap((entry) => entry.imports ?? []));
    const hidden = authoredAccepted.filter((path) => !visibleImports.has(path));
    if (hidden.length) return { boundary: 'preview', detail: `Accepted but not rendered by any routed page: ${hidden.join(', ')}`, authoredAtRaw: [...authoredAtRaw], authoredAccepted };
  }
  return { boundary: 'none', detail: 'Authored modules survived from the AI output to the accepted revision.', authoredAtRaw: [...authoredAtRaw], authoredAccepted };
}
