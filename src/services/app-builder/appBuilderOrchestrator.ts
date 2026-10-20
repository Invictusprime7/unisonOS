/** Candidate-only full-application orchestration behind UnisonAppBuilder. */

import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import type { ComposerLoopInput, ComposerLoopResult } from '@/services/builder/aiRepairLoop';
import type { SiteAuthoringInput, SiteAuthoringResult } from '@/services/launch/siteAuthoringOrchestrator';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildRequest, type AppBuildResult } from './appBuilderContracts';
import { findDesignSourceUsageIssues, validateAppBuildCandidate } from './appBuilderCandidate';
import { evaluateDesignQuality } from './design/designQualityClosure';
import { applyDesignSources } from './design/designSourceMaterializer';
import { buildAppBuilderGenerationContext, reportDesignSourceUsage } from './appBuilderGenerationContext';
import { findPageStructureIssues, pageStructureRequirement, verifiedPhotosFor } from './design/pageStructureGate';

export interface AppBuilderOrchestratorDependencies {
  authorSite: (input: SiteAuthoringInput) => Promise<SiteAuthoringResult>;
  runComposer: (input: ComposerLoopInput) => Promise<ComposerLoopResult>;
}

const CLOSURE_REPAIR_RESERVE_MS = 75_000;
// A site-wide repair resends every page (~160k chars); the AI needs well over
// 20s for that. With less time left the request can only time out, so skip it.
const MIN_CLOSURE_REPAIR_MS = 60_000;

export async function orchestrateAppBuild(
  input: AppBuildRequest,
  dependencies: AppBuilderOrchestratorDependencies,
): Promise<AppBuildResult> {
  const pages = input.contract.topology.sitePlan.pages.map((page) => ({
    pageId: page.id,
    title: page.title,
    route: page.route,
    filePath: page.filePath,
    role: page.role,
  }));
  // Timing only (never a design input): page authoring must leave room for the
  // site-wide closure repair inside the same stage budget, otherwise the repair
  // starts after the budget is spent and the launch watchdog fires.
  const startedAt = Date.now();
  const totalBudgetMs = input.budgetMs ?? 280_000;
  const authoringBudgetMs = Math.max(60_000, totalBudgetMs - CLOSURE_REPAIR_RESERVE_MS);
  const generation = buildAppBuilderGenerationContext(input.contract);
  const baseFiles = applyDesignSources(input.initialFiles, generation.materialization);
  const manifestSource = baseFiles['/.unison/design-source-manifest.json'];
  const contractPages = input.contract.design.resolvedSiteDesignContext.contract.pages;
  const roleByPath = new Map(pages.map((page) => [page.filePath, page.role]));
  const photoUrls = verifiedPhotosFor(input.contract.design.resolvedSiteDesignContext?.contract.industry ?? input.contract.business.industry);
  const pageCheck = (path: string, source: string, files?: Readonly<Record<string, string>>) => {
    const messages = findDesignSourceUsageIssues(manifestSource, source).map((issue) => issue.message);
    const role = roleByPath.get(path);
    if (role) {
      const requirement = pageStructureRequirement(role, contractPages[role]?.densityBudget?.min, photoUrls);
      messages.push(...findPageStructureIssues(path, source, files ?? { [path]: source }, requirement));
    }
    return messages;
  };
  const authored = await dependencies.authorSite({
    pages,
    homePageId: input.contract.topology.sitePlan.homePageId,
    designContext: input.contract.design.resolvedSiteDesignContext,
    businessName: input.contract.business.businessName,
    visionBrief: input.contract.business.visionBrief,
    files: { ...baseFiles },
    revisionId: input.baseRevisionId,
    signal: input.signal,
    budgetMs: authoringBudgetMs,
    maxPages: input.maxPages,
    concurrency: input.concurrency,
    preflight: input.preflight,
    onProgress: input.onProgress,
    commitPage: input.acceptPage ?? (async (nextFiles) => ({
      files: nextFiles,
      revisionId: input.baseRevisionId,
    })),
    compositionPlan: input.contract.design.compositionPlan,
    registryContext: input.contract.design.registryContext,
    runtimeContext: generation.runtimeContext,
    runtimeContextForPage: generation.runtimeContextForPage,
    pageCheck,
    reuseAcceptedPages: true,
    resolveDependencies: false,
  });

  const compatibilityMode = Boolean(input.acceptPage);
  let candidateFiles = { ...authored.files };
  if (!compatibilityMode && input.preflight) candidateFiles = input.preflight(candidateFiles);
  let closure = await validateAppBuildCandidate({
    contract: input.contract,
    files: candidateFiles,
    initialFiles: baseFiles,
  });
  let closureRepairAttempts = 0;

  // One site-wide repair attempt sees the complete closure diagnostics and protected-path constraints.
  const closureTimeLeftMs = startedAt + totalBudgetMs - Date.now();
  if (!compatibilityMode && !closure.ok && !input.signal?.aborted && closureTimeLeftMs >= MIN_CLOSURE_REPAIR_MS) {
    const home = pages.find((page) => page.pageId === input.contract.topology.sitePlan.homePageId) ?? pages[0];
    if (home) {
      const diagnostics = closure.issues
        .filter((issue) => issue.severity === 'blocker')
        .map((issue) => `${issue.code}${issue.path ? ` (${issue.path})` : ''}: ${issue.message}`)
        .slice(0, 30);

      // Enhanced repair instruction for protected-path violations
      const hasProtectedPathViolation = diagnostics.some(d => d.includes('protected-source-changed'));
      const repairInstruction = hasProtectedPathViolation
        ? 'Resolve every supplied closure diagnostic across the candidate application. IMPORTANT: Do not modify package.json, tsconfig.json, or .unison/* files — these are canonical infrastructure. Work only within approved dependencies and available component imports. If imports are missing, use only components and utilities already available in the approved dependencies.'
        : 'Resolve every supplied closure diagnostic across the candidate application.';

      const assembled = await assembleCanonicalAuthoringRequest({
        task: 'site_page_repair',
        page: home,
        brief: 'Repair site-wide application closure without changing canonical infrastructure or the sealed design identity.',
        knowledgeQuery: `${input.contract.business.industry} site-wide module route design closure`,
        instruction: repairInstruction,
        baseFiles: candidateFiles,
        baseRevisionId: input.baseRevisionId,
        // Send only the pages the diagnostics name: resending every page (~150k
        // chars) made the repair time out and the launch fail on one page.
        sourceTargets: (() => {
          const failing = pages.filter((page) => diagnostics.some((d) => d.includes(page.filePath) || d.includes(page.filePath.replace('/src/', './'))));
          return (failing.length ? failing : pages).map((page) => page.filePath);
        })(),
        routes: pages.map((page) => ({ title: page.title, route: page.route })),
        registryContext: input.contract.design.registryContext,
        runtimeContext: `${generation.runtimeContext}`.slice(0, 12000),
        diagnostics,
      });
      const repaired = await dependencies.runComposer({
        request: assembled.request,
        baseFiles: candidateFiles,
        baseRevisionId: input.baseRevisionId ?? undefined,
        maxAttempts: 2,
        signal: input.signal,
        timeoutMs: closureTimeLeftMs,
        preflight: input.preflight,
        candidateOrigin: 'repair',
        candidateIntent: 'site-wide-closure',
        pageCheck,
        resolveDependencies: false,
      });
      closureRepairAttempts = repaired.attempts;
      if (repaired.ok && repaired.prepared) {
        candidateFiles = repaired.prepared.nextFiles;
        if (input.preflight) candidateFiles = input.preflight(candidateFiles);
        closure = await validateAppBuildCandidate({
          contract: input.contract,
          files: candidateFiles,
          initialFiles: baseFiles,
        });
      }
    }
  }

  const cancelled = input.signal?.aborted === true;
  const ready = compatibilityMode || closure.ok;
  const authorDiagnostics = authored.outcomes.flatMap((outcome) => outcome.errors);
  const closureDiagnostics = closure.issues
    .filter((issue) => issue.severity === 'blocker')
    .map((issue) => issue.message);
  const strategy = compatibilityMode
    ? 'legacy-commit-adapter' as const
    : closureRepairAttempts > 0
      ? 'ai-candidate+closure-repair' as const
      : 'ai-candidate' as const;
  const candidate = {
    candidateId: `${input.operationId}:candidate:${closure.sourceHash.replace(':', '_')}`,
    status: cancelled ? 'cancelled' as const : ready ? 'ready-for-commit' as const : 'rejected' as const,
    files: candidateFiles,
    entryPoint: input.entryPoint,
    attempts: authored.outcomes.reduce((total, outcome) => total + outcome.attempts, 0) + closureRepairAttempts,
    diagnostics: [...authorDiagnostics, ...closureDiagnostics],
    closure,
    provenance: {
      protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
      operationId: input.operationId,
      baseRevisionId: input.baseRevisionId ?? null,
      contractSeed: input.contract.design.seed,
      sourceHash: closure.sourceHash,
      authoredPageIds: pages.map((page) => page.pageId),
      strategy,
    },
  };
  return {
    operationId: input.operationId,
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    candidate,
    candidateFiles,
    stopReason: cancelled ? 'cancelled' : ready ? 'complete' : closureRepairAttempts ? 'repair-exhausted' : 'validation-failed',
    outcomes: authored.outcomes,
    revisionId: authored.revisionId,
  };
}
