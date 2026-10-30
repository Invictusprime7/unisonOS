/**
 * Site authoring orchestrator (milestone §3, §18, §19, §30).
 *
 * Page-by-page AI authoring on top of the committed deterministic substrate:
 *
 *   Home first, then remaining pages in parallel (bounded concurrency):
 *     build page brief from ResolvedSiteDesignContext
 *     composer repair loop (candidate + blocking gates, max 3)
 *     accepted -> caller commits through the single legal writer
 *     rejected -> page keeps its last-known-good committed version
 *
 * Owns no writer, no VFS, no snapshot. `commitPage` is supplied by the caller
 * (launch orchestrator / Builder) and must go through commitMutation.
 */

import { AI_AUTHORED_MARKER } from '@/contracts/aiComposerContract';
import type { ResolvedSiteDesignContext } from '@/services/launch/resolvedSiteDesignContext';
import { projectSiteDesignContract } from '@/services/launch/siteDesignContract';
import type { AIComposerRequest } from '@/contracts/aiComposerContract';
import { runComposerRepairLoop, type ComposerInvoke, type ComposerLoopResult, type ComposerStopReason } from '@/services/builder/aiRepairLoop';
import { buildAICandidateChangeSet, type AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import { selectSourceKnowledge } from '@/services/builder/sourceKnowledgeContext';
import { isImageLedRole, verifiedPhotosFor } from '@/services/app-builder/design/pageStructureGate';
import { createSectionAuthoringInvoke } from '@/services/launch/sectionAuthoringInvoke';
import {
  extractHomepageVisualLanguage,
  renderHomepageInheritanceContract,
  type HomepageVisualLanguage,
} from '@/services/launch/homepageFirstContract';

import {
  createSiteVisualMemory,
  extractCompositionSignature,
  findRedundancy,
  planSiteComposition,
  renderCompositionBrief,
  type RedundancyIssue,
  type SiteCompositionPlan,
} from '@/services/composition';

export interface AuthoringPage {
  pageId: string;
  title: string;
  route: string;
  filePath: string;
  role: string;
}

export interface PageAuthoringOutcome {
  page: AuthoringPage;
  status: 'authored' | 'kept-baseline' | 'skipped';
  reason: ComposerStopReason | 'budget' | 'paused' | 'commit_failed';
  attempts: number;
  summary?: string;
  errors: string[];
  revisionId?: string | null;
  /** The AI returned a draft for this page before a later fix round stopped. */
  draftProduced?: boolean;
}

export interface SiteAuthoringProgress {
  page: AuthoringPage;
  index: number;
  total: number;
  phase: 'authoring' | 'committed' | 'kept-baseline';
}

export interface SiteAuthoringInput {
  pages: AuthoringPage[];
  homePageId?: string;
  industry?: string;
  existingRoutes?: readonly { title: string; route: string }[];
  designContext: ResolvedSiteDesignContext | null;
  businessName: string;
  /** Owner's own description from the home-page planning chat. */
  visionBrief?: string;
  files: Record<string, string>;
  revisionId?: string | null;
  candidateOrigin?: 'builder' | 'wizard';
  initialRouteOps?: readonly TopologyChange[];
  commitPage: (nextFiles: Record<string, string>, page: AuthoringPage, beforeFiles: Record<string, string>, candidate: AICandidateChangeSet) =>
    Promise<{ files: Record<string, string>; revisionId?: string | null }>;
  preflight?: (changed: Record<string, string>) => Record<string, string>;
  onProgress?: (event: SiteAuthoringProgress) => void;
  /** Total wall-clock budget; pages past it keep their baseline. */
  budgetMs?: number;
  maxPages?: number;
  /** Pages authored in parallel after Home (default 3). */
  concurrency?: number;
  signal?: AbortSignal;
  invoke?: ComposerInvoke;
  gatewayOptions?: Record<string, unknown>;
  now?: () => number;
  /** Site-wide composition plan (hero patterns, geometry allocation, section order). */
  compositionPlan?: SiteCompositionPlan;
  /** Registry context for component availability (sections, variants). */
  registryContext?: unknown;
  /** Extra runtime facts for every page turn (e.g. certified design-source modules with prop contracts). */
  runtimeContext?: string;
  /** Per-page override of runtimeContext (trimmed to the modules that page can use). */
  runtimeContextForPage?: (pageId: string) => string;
  /** Per-page design-source check run inside each page's repair loop. */
  pageCheck?: (path: string, source: string) => string[];
  /** Reuse pages accepted by an earlier identical authoring run (default off). */
  reuseAcceptedPages?: boolean;
  /** false keeps /package.json untouched in authored candidates. */
  resolveDependencies?: boolean;
}

export interface AcceptedPageEntry {
  changed: Record<string, string>;
  deleted: string[];
  routeOps: unknown;
  evidence: unknown;
  summary: string;
}

/** Accepted-page cache: a retry with an identical page contract reuses the page instead of re-authoring. */
const acceptedPages = new Map<string, AcceptedPageEntry>();
const MAX_ACCEPTED_PAGES = 64;
function hashKey(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h * 33) ^ value.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + value.length;
}

export function clearAcceptedPageCache(): void {
  acceptedPages.clear();
}

export interface SiteAuthoringResult {
  files: Record<string, string>;
  revisionId?: string | null;
  outcomes: PageAuthoringOutcome[];
}


/** Deterministic order: home first, then by route. */
export function orderAuthoringPages(pages: AuthoringPage[], homePageId?: string): AuthoringPage[] {
  return [...pages].sort((a, b) => {
    const ah = a.pageId === homePageId || a.route === '/' ? 0 : 1;
    const bh = b.pageId === homePageId || b.route === '/' ? 0 : 1;
    return ah - bh || a.route.localeCompare(b.route) || a.pageId.localeCompare(b.pageId);
  });
}

export function renderPageBrief(
  ctx: ResolvedSiteDesignContext | null,
  page: AuthoringPage,
  businessName: string,
  establishedLanguage?: HomepageVisualLanguage,
): string {
  const lines = [`BUSINESS: ${businessName}`, `PAGE ROLE: ${page.role}`];
  if (!ctx) return [...lines, renderHomepageInheritanceContract(establishedLanguage)].filter(Boolean).join('\n');
  const projection = projectSiteDesignContract(ctx.contract);
  // Only this page's archetype block: other pages' blocks crowd out the page's own composition target.
  const summaryLines: string[] = [];
  let keep = true;
  for (const line of projection.summary.split('\n')) {
    const pageHeader = /^ {2}page "([^"]+)"/.exec(line);
    if (pageHeader) keep = pageHeader[1] === page.role || (!ctx.contract.pages[page.role] && pageHeader[1] === 'custom');
    else if (!/^ {4}/.test(line)) keep = true;
    if (keep) summaryLines.push(line);
  }
  const pageMin = ctx.contract.pages[page.role]?.densityBudget?.min;
  const preferred = Object.entries(ctx.creativeRecommendation.preferredImplementations)
    .map(([family, ids]) => `${family}: ${(ids ?? []).slice(0, 4).join(', ')}`);
  const forbidden = Object.entries(ctx.hardLegality.forbiddenImplementations)
    .map(([family, ids]) => `${family}: ${(ids ?? []).join(', ')}`);
  lines.push(
    `INDUSTRY: ${ctx.contract.industry}`,
    `ART DIRECTION PACK: ${ctx.contract.artDirectionPackId}`,
    `EXPERIENCE: ${ctx.contract.experience}`,
    `DESIGN CONTRACT:\n${summaryLines.join('\n')}`,
    `PAGE STRUCTURE (enforced): render the shared site nav first and the shared footer last (one shared component each, e.g. /src/project-components/site/SiteNav.tsx and SiteFooter.tsx, linking every route; create them once if missing, reuse them otherwise). Body: at least ${Math.max(page.role === 'home' ? 3 : 2, Math.min(pageMin ?? 0, 4))} distinct sections following the COMPOSITION TARGET, varying layout (split, full-bleed media, grid, editorial rows) — never a lone centered hero. Use real photography wherever the page is media-led.`,
    `SECTION IDENTITY (required for every page-level body <section>): use a unique, stable literal data-ut-section-id such as "${page.pageId}:services:0", data-ut-section-type such as "services", and data-ut-variant such as "services:editorial-rows". IDs are pageId:section-family:zero-based occurrence and must remain unchanged across content edits and layout swaps.`,
    'SITE CHROME IDENTITY (required on every page): wrap the shared registered navbar dispatcher in <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="<eligible navbar variant>"> and the shared registered footer dispatcher in <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="<eligible footer variant>". Reuse these exact IDs and the same variants across all pages; the matching dispatcher variantId must equal the wrapper data-ut-variant.',
    'SECTION DATA AND RENDERING (required): render each section as a <section> wrapper containing exactly one default family dispatcher imported from the matching @/unison/design-sources/<Family> module, e.g. import Services from "@/unison/design-sources/Services"; <Services sectionId="<same section ID>" variantId="services:editorial-rows" props={{ headline: "...", items: [...] }} />. Use the same stable sectionId on the wrapper data-ut-section-id and dispatcher sectionId props, and the same registered variantId on the wrapper data-ut-variant and dispatcher prop. Keep all section content props in a JSON-serializable literal props object. Do not render named variant exports directly, spread dynamic props, or place multiple dispatchers under one section wrapper. Keep registered intent, CTA, resource, and component-instance markers intact inside their existing section content.',
    preferred.length ? `PREFERRED CANONICAL VOCABULARY:\n${preferred.join('\n')}` : '',
    forbidden.length ? `FORBIDDEN IMPLEMENTATIONS (never use):\n${forbidden.join('\n')}` : '',
    `CREATIVE AUTHORITY: ${ctx.creativeRecommendation.guidance}`,
    `AFFINITY INVARIANTS: Preserve pack ${ctx.affinity.invariants.artDirectionPackId}; its typography, geometry, spacing cadence, media treatment, motion character, and shared chrome identity are site-wide.`,
    `PAGE-LOCAL VARIANTS: ${ctx.affinity.looseFit.guidance}`,
    ctx.affinity.variants[page.role]
      ? `PAGE INTENT FIT: ${ctx.affinity.variants[page.role].purpose} Rhythm ${ctx.affinity.variants[page.role].rhythm}; density ${ctx.affinity.variants[page.role].density}; variation remains open for ${ctx.affinity.variants[page.role].allowedVariation.join(', ')}.`
      : `LOOSE-FIT PAGE INTENT: Treat "${page.role}" as ${ctx.affinity.looseFit.fallbackRole}; preserve invariants and choose any legal, purpose-fit variants.`,
    renderHomepageInheritanceContract(establishedLanguage),
    `DESIGN FINGERPRINT: ${ctx.fingerprint}`,
  );
  return lines.filter(Boolean).join('\n');
}

/** Target page, theme, shared chrome and transitive component APIs. */
export function selectPageContextFiles(files: Record<string, string>, page: AuthoringPage): Record<string, string> {
  return selectSourceKnowledge(files, [page.filePath]);
}

export async function authorSitePages(input: SiteAuthoringInput): Promise<SiteAuthoringResult> {
  const now = input.now ?? (() => Date.now());
  const candidateOrigin = input.candidateOrigin ?? 'wizard';
  const deadline = now() + (input.budgetMs ?? 240_000);
  // Default: after Home, write up to 4 pages at once — fast, within the shared rate limit.
  const concurrency = Math.max(1, Math.floor(input.concurrency ?? 4));
  const ordered = orderAuthoringPages(input.pages, input.homePageId).slice(0, input.maxPages ?? Infinity);
  const routes = [...(input.existingRoutes ?? []), ...ordered.map((p) => ({ title: p.title, route: p.route }))];
  let files = input.files;
  let revisionId = input.revisionId;
  const outcomes: PageAuthoringOutcome[] = [];
  const priorPages: Array<{ role: string; summary: string }> = [];
  let paused: ComposerStopReason | null = null;
  // Builder additions do not author Home again: inherit its accepted source.
  let establishedLanguage: HomepageVisualLanguage | undefined;
  let referenceHomePath: string | undefined;
  if (candidateOrigin === 'builder') {
    try {
      const snapshot = JSON.parse(files['/.unison/site-bundle-snapshot.json'] ?? '{}') as {
        pageRegistry?: { homePageId?: string; pages?: Record<string, { path?: string; filePath?: string }> };
      };
      const pages = snapshot.pageRegistry?.pages ?? {};
      const homeId = snapshot.pageRegistry?.homePageId;
      const home = (homeId ? pages[homeId] : undefined) ?? Object.values(pages).find(page => page.path === '/');
      if (home?.filePath && typeof files[home.filePath] === 'string') {
        referenceHomePath = home.filePath;
        establishedLanguage = extractHomepageVisualLanguage(files[home.filePath], homeId ?? 'home');
      }
    } catch { /* Missing snapshot is handled by the existing candidate gates. */ }
    if (!establishedLanguage && files['/src/pages/Home.tsx']) {
      referenceHomePath = '/src/pages/Home.tsx';
      establishedLanguage = extractHomepageVisualLanguage(files['/src/pages/Home.tsx'], 'home');
    }
  }
  // One universal planner assigns each page a distinct narrative + topology job.
  // A sealed plan from the AppBuildContract is authoritative; replanning here would fork the design.
  const compositionPlan = input.compositionPlan ?? planSiteComposition(
    input.designContext?.contract.industry ?? input.industry ?? 'generic',
    ordered.map((p) => ({ pageId: p.pageId, role: p.role })),
    input.designContext?.fingerprint ?? input.businessName,
    {
      artDirection: input.designContext?.contract.artDirectionPackId,
      businessTraits: input.designContext
        ? [input.designContext.contract.experience, input.designContext.contract.mode]
        : [],
    },
  );
  const visualMemory = createSiteVisualMemory();

  const outcomeSlots: Array<PageAuthoringOutcome | undefined> = new Array(ordered.length);
  // Commits are serialized so each page lands on the latest committed files.
  let commitChain: Promise<void> = Promise.resolve();
  let stopTriggeredByPageIndex: number | undefined;
  const authoringController = new AbortController();
  const abortAuthoring = () => {
    paused = paused ?? 'aborted';
    if (!authoringController.signal.aborted) authoringController.abort(input.signal?.reason);
  };
  if (input.signal?.aborted) abortAuthoring();
  else input.signal?.addEventListener('abort', abortAuthoring, { once: true });

  const authorOne = async (page: AuthoringPage, index: number): Promise<void> => {
    if (paused || authoringController.signal.aborted) {
      outcomeSlots[index] = { page, status: 'skipped', reason: 'paused', attempts: 0, errors: [] };
      return;
    }
    if (now() >= deadline) {
      outcomeSlots[index] = { page, status: 'kept-baseline', reason: 'budget', attempts: 0, errors: ['Time budget reached.'] };
      input.onProgress?.({ page, index, total: ordered.length, phase: 'kept-baseline' });
      return;
    }
    input.onProgress?.({ page, index, total: ordered.length, phase: 'authoring' });
    const baseFiles = files;
    const planned = compositionPlan.pages.find((p) => p.pageId === page.pageId);
    const buildRequest = async (redundancy: RedundancyIssue | null): Promise<AIComposerRequest> => (await assembleCanonicalAuthoringRequest({
      task: 'site_page_author',
      page: { role: page.role, title: page.title, route: page.route, filePath: page.filePath },
      // Layout plan and design contract lead; the planning-chat vision follows so it
      // shapes wording/content without displacing composition vocabulary.
      brief: (() => {
        const layout = [
          renderCompositionBrief(planned, visualMemory.entries(), redundancy),
          renderPageBrief(input.designContext, page, input.businessName, establishedLanguage),
        ].filter(Boolean).join('\n');
        const vision = input.visionBrief
          ? `OWNER VISION (from the planning chat; use it for wording and content only — never let it override the layout plan, section vocabulary or sealed design above): ${input.visionBrief.slice(0, 1200)}`
          : '';
        // Photo library sits outside the truncated layout so it can never be cut off.
        const photos = isImageLedRole(page.role)
          ? `PHOTO LIBRARY (required — this page is image-led and is rejected without photos): render at least one <img src="..."> in the page file itself using these verified URLs, copied exactly; never invent other image URLs:\n${verifiedPhotosFor(input.designContext?.contract.industry).join('\n')}`
          : '';
        const room = 8000 - (vision ? vision.length + 1 : 0) - (photos ? photos.length + 1 : 0);
        return [photos, layout.slice(0, Math.max(5500, room)), vision].filter(Boolean).join('\n').slice(0, 8000);
      })(),
      knowledgeQuery: `${input.businessName} ${page.role} ${page.title} ${page.route}`,
      baseFiles,
      baseRevisionId: revisionId,
      sourceTargets: [page.filePath, ...(referenceHomePath ? [referenceHomePath] : [])],
      routes,
      priorPages: priorPages.slice(-20),
      registryContext: input.registryContext,
      runtimeContext: [
        referenceHomePath ? `Existing homepage ${referenceHomePath} is read-only design/API reference. Reuse its shared chrome, semantic tokens and imported component contracts; do not rewrite it or change the site's art direction.` : '',
        input.designContext
          ? `Industry ${input.designContext.contract.industry}; experience ${input.designContext.contract.experience}; forbidden implementations ${JSON.stringify(input.designContext.hardLegality.forbiddenImplementations)}.`
          : '',
        input.runtimeContextForPage?.(page.pageId) ?? input.runtimeContext ?? '',
      ].filter(Boolean).join('\n').slice(0, 12000) || undefined,
    })).request;
    // Reserve one turn for each remaining worker wave. Home must not consume
    // the time needed to author the other selected pages.
    const remainingPages = Math.max(0, ordered.length - index - 1);
    const waves = index === 0 ? 1 + Math.ceil(remainingPages / concurrency)
      : Math.max(1, Math.ceil((ordered.length - index) / concurrency));
    // A page needs ~45-90s to author plus ~60s for one repair turn; a shorter
    // window only produces a guaranteed timeout. Later pages past the overall
    // budget keep their baseline instead.
    const pageDeadline = Math.min(deadline, now() + Math.min(150_000, Math.max(120_000, (deadline - now()) / waves)));
    const loopInput = (request: AIComposerRequest) => ({
      request,
      baseFiles,
      baseRevisionId: revisionId ?? undefined,
      preflight: input.preflight,
      signal: authoringController.signal,
      timeoutMs: Math.max(1, pageDeadline - now()),
      invoke: input.designContext && planned
        ? createSectionAuthoringInvoke(input.invoke, planned.target.sectionOrder, () => {
          input.onProgress?.({ page, index, total: ordered.length, phase: 'authoring' });
        })
        : input.invoke,
      gatewayOptions: input.gatewayOptions,
      affinity: {
        language: establishedLanguage,
        forbiddenImplementations: input.designContext?.hardLegality.forbiddenImplementations,
      },
      candidateOrigin,
      candidateIntent: `author:${page.role}`,
      initialRouteOps: input.initialRouteOps,
      resolveDependencies: input.resolveDependencies,
      pageCheck: input.pageCheck,
    });
    const runLoop = (request: AIComposerRequest) => runComposerRepairLoop(loopInput(request));
    const firstRequest = await buildRequest(null);
    const cacheKey = input.reuseAcceptedPages
      ? hashKey(JSON.stringify([page, input.businessName, input.designContext?.fingerprint, firstRequest.brief, firstRequest.runtimeContext, firstRequest.files, firstRequest.routes]))
      : undefined;
    const cached = cacheKey ? acceptedPages.get(cacheKey) : undefined;
    let loop: ComposerLoopResult;
    if (cached) {
      const reused: Record<string, string> = { ...baseFiles, ...cached.changed };
      for (const path of cached.deleted) delete reused[path];
      loop = {
        ok: true,
        reason: 'accepted',
        attempts: 0,
        response: { summary: cached.summary } as ComposerLoopResult['response'],
        prepared: {
          ok: true,
          nextFiles: reused,
          errors: [],
          build: { changeSet: { routeOps: cached.routeOps, provenance: { evidence: cached.evidence } } },
          gates: { passed: true, failures: [], advisories: [] },
        } as unknown as ComposerLoopResult['prepared'],
        errors: [],
      };
    } else {
      loop = await runLoop(firstRequest);
    }
    // Redundancy check: one targeted recomposition when this page repeats another page's topology.
    const terminalPageFailure = ['credits', 'denied', 'rate_limited', 'provider', 'invalid_response'].includes(loop.reason)
      || (loop.reason === 'aborted' && !authoringController.signal.aborted);
    if (terminalPageFailure) {
      paused = paused ?? loop.reason;
      stopTriggeredByPageIndex = index;
      if (!authoringController.signal.aborted) {
        authoringController.abort(new DOMException(`Page authoring stopped after ${loop.reason}.`, 'AbortError'));
      }
    }
    if (!cached && loop.ok && loop.prepared && now() < deadline) {
      const issue = findRedundancy(page.pageId, extractCompositionSignature(loop.prepared.nextFiles[page.filePath]), visualMemory.entries());
      if (issue) {
        const retry = await runLoop(await buildRequest(issue));
        if (retry.ok && retry.prepared) loop = retry;
      }
    }
    if (!loop.ok || !loop.prepared) {
      const siblingStopped = loop.reason === 'aborted'
        && authoringController.signal.aborted
        && index !== stopTriggeredByPageIndex;
      outcomeSlots[index] = {
        page,
        status: siblingStopped ? 'skipped' : 'kept-baseline',
        reason: siblingStopped ? 'paused' : loop.reason,
        attempts: loop.attempts,
        errors: loop.errors,
        draftProduced: Boolean(loop.resume || loop.response),
      };
      input.onProgress?.({ page, index, total: ordered.length, phase: 'kept-baseline' });
      return;
    }
    const prepared = loop.prepared;
    const run = commitChain.then(async () => {
      try {
        // Rebase only the keys this candidate changed onto the latest commit,
        // preserving newer shared-file edits made by pages authored in parallel.
        const candidate = stampAuthoredPage(prepared.nextFiles, page, input.designContext?.fingerprint);
        const nextFiles: Record<string, string> = { ...files };
        for (const [path, content] of Object.entries(candidate)) {
          if (baseFiles[path] === content) continue;
          if (path === page.filePath || baseFiles[path] === files[path] || files[path] === content) {
            nextFiles[path] = content;
          }
        }
        for (const path of Object.keys(baseFiles)) {
          if (!(path in candidate) && baseFiles[path] === files[path]) delete nextFiles[path];
        }
        // Rebuild after the authorship stamp so the committed operation record
        // describes the exact bytes handed to the canonical writer.
        const finalCandidate = buildAICandidateChangeSet({
          aiFiles: nextFiles,
          baseFiles: files,
          baseRevisionId: revisionId ?? undefined,
          targetPages: [page.filePath],
          resolveDependencies: false,
          origin: candidateOrigin,
          intent: `author:${page.role}`,
          routeOps: prepared.build.changeSet.routeOps,
          evidence: prepared.build.changeSet.provenance.evidence,
        }).changeSet;
        const committed = await input.commitPage(nextFiles, page, files, finalCandidate);
        files = committed.files;
        visualMemory.record(page.pageId, page.role, extractCompositionSignature(files[page.filePath]));
        if (page.pageId === input.homePageId || page.route === '/') {
          establishedLanguage = extractHomepageVisualLanguage(files[page.filePath], page.pageId);
        }
        revisionId = committed.revisionId ?? revisionId;
        const summary = loop.response?.summary ?? '';
        priorPages.push({ role: page.role, summary: summary.slice(0, 2000) });
        if (cacheKey && !cached) {
          const changed: Record<string, string> = {};
          for (const [path, content] of Object.entries(candidate)) if (baseFiles[path] !== content) changed[path] = content;
          if (acceptedPages.size >= MAX_ACCEPTED_PAGES) acceptedPages.delete(acceptedPages.keys().next().value as string);
          acceptedPages.set(cacheKey, {
            changed,
            deleted: Object.keys(baseFiles).filter((path) => !(path in candidate)),
            routeOps: prepared.build.changeSet.routeOps,
            evidence: prepared.build.changeSet.provenance.evidence,
            summary,
          });
        }
        outcomeSlots[index] = { page, status: 'authored', reason: 'accepted', attempts: loop.attempts, summary, errors: [], revisionId: committed.revisionId };
        input.onProgress?.({ page, index, total: ordered.length, phase: 'committed' });
      } catch (error) {
        outcomeSlots[index] = {
          page, status: 'kept-baseline', reason: 'commit_failed', attempts: loop.attempts,
          errors: [error instanceof Error ? error.message : String(error)],
        };
        input.onProgress?.({ page, index, total: ordered.length, phase: 'kept-baseline' });
      }
    });
    commitChain = run;
    await run;
  };

  // Home first (it establishes the site's visual language), then the rest
  // in parallel with bounded concurrency.
  try {
    if (ordered.length > 0) await authorOne(ordered[0], 0);
    let cursor = 1;
    const worker = async () => {
      while (cursor < ordered.length) {
        const index = cursor++;
        await authorOne(ordered[index], index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(0, ordered.length - 1)) }, worker));
  } finally {
    input.signal?.removeEventListener('abort', abortAuthoring);
  }
  outcomes.push(...outcomeSlots.filter((o): o is PageAuthoringOutcome => Boolean(o)));
  return { files, revisionId, outcomes };
}

/** Provenance: the committed page carries a verifiable AI-authorship header. */
export function stampAuthoredPage(
  files: Record<string, string>,
  page: { filePath: string; role: string },
  fingerprint: string | undefined,
): Record<string, string> {
  const source = files[page.filePath];
  if (typeof source !== 'string') return files;
  const body = source.replace(/^\/\/ @unison-ai-authored[^\n]*\n/, '');
  const header = `${AI_AUTHORED_MARKER} role=${page.role} design=${fingerprint ?? 'unknown'}\n`;
  return { ...files, [page.filePath]: header + body };
}
