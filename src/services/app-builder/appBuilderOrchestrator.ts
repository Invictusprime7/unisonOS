/** Candidate-only full-application orchestration behind UnisonAppBuilder. */

import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import type { ComposerLoopInput, ComposerLoopResult } from '@/services/builder/aiRepairLoop';
import type { SiteAuthoringInput, SiteAuthoringResult } from '@/services/launch/siteAuthoringOrchestrator';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildRequest, type AppBuildResult } from './appBuilderContracts';
import { findDesignSourceUsageIssues, validateAppBuildCandidate } from './appBuilderCandidate';
import { materializeRegisteredComponents } from './registeredComponentMaterializer';
import { evaluateDesignQuality } from './design/designQualityClosure';
import { applyDesignSources } from './design/designSourceMaterializer';
import { buildAppBuilderGenerationContext, reportDesignSourceUsage } from './appBuilderGenerationContext';
import { findPageStructureIssues, pageStructureRequirement, verifiedPhotosFor } from './design/pageStructureGate';
import type { ContentTypeRow } from '@/services/resources/resourceRegistry';
import { normalizeWizardBindingMarkers } from '@/services/wizardBindingBridge';
import { inspectAppBuilderPageSectionClosure, materializeAppBuilderSectionModels } from './appBuilderSectionModel';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';

export interface AppBuilderOrchestratorDependencies {
  authorSite: (input: SiteAuthoringInput) => Promise<SiteAuthoringResult>;
  runComposer: (input: ComposerLoopInput) => Promise<ComposerLoopResult>;
  loadContentTypes?: (scope: { businessId: string; projectId: string }) => Promise<ContentTypeRow[]>;
}

const CLOSURE_REPAIR_RESERVE_MS = 75_000;
const MAX_CLOSURE_REPAIR_MS = 90_000;
// A site-wide repair resends every page (~160k chars); the AI needs well over
// 20s for that. With less time left the request can only time out, so skip it.
const MIN_CLOSURE_REPAIR_MS = 60_000;

export async function orchestrateAppBuild(
  input: AppBuildRequest,
  dependencies: AppBuilderOrchestratorDependencies,
): Promise<AppBuildResult> {
  input.onStatus?.('Preparing App Builder context');
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
  let contentTypes: ContentTypeRow[] = [];
  if (dependencies.loadContentTypes) {
    try {
      contentTypes = await dependencies.loadContentTypes({
        businessId: input.contract.identity.businessId,
        projectId: input.contract.identity.projectId,
      });
    } catch (error) {
      // CMS schemas enrich authoring only; fresh-launch project IDs may not be
      // persisted until owner approval, and CMS writes remain post-commit.
      console.warn('[AppBuilder] Content-type context unavailable; continuing without CMS schema hints.', error);
    }
  }
  const generation = buildAppBuilderGenerationContext(input.contract, contentTypes);
  const baseFiles = applyDesignSources(input.initialFiles, generation.materialization);
  const manifestSource = baseFiles['/.unison/design-source-manifest.json'];
  const contractPages = input.contract.design.resolvedSiteDesignContext.contract.pages;
  const roleByPath = new Map(pages.map((page) => [page.filePath, page.role]));
  const sectionImplementations = generation.materialization.manifest.implementations;
  const photoUrls = verifiedPhotosFor(input.contract.design.resolvedSiteDesignContext?.contract.industry ?? input.contract.business.industry);
  let unresolvedMarkerBindingIds: string[] = [];
  const pageCheck = (path: string, source: string, files?: Readonly<Record<string, string>>) => {
    const messages = findDesignSourceUsageIssues(manifestSource, source).map((issue) => issue.message);
    if (Object.keys(sectionImplementations).length > 0) {
      const page = pages.find((candidate) => candidate.filePath === path);
      const normalizedFiles = materializeAppBuilderSectionModels(
        { ...(files ?? {}), [path]: source },
        [{ id: page?.pageId ?? path, filePath: path, route: page?.route }],
        sectionImplementations,
        generation.designSources.eligibleByPage,
      );
      messages.push(...inspectAppBuilderPageSectionClosure(path, normalizedFiles, sectionImplementations).issues);
    }
    messages.push(...(input.pageCheck?.(path, source, files) ?? []));
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
    gatewayOptions: input.gatewayOptions,
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
    runtimeContext: input.runtimeContext ?? '',
    runtimeContextForPage: (pageId) => [input.runtimeContext, generation.runtimeContextForPage(pageId)].filter(Boolean).join('\n'),
    pageCheck,
    reuseAcceptedPages: input.reuseAcceptedPages ?? true,
    resolveDependencies: false,
  });
  input.onStatus?.('Checking authored pages, sections and bindings');

  const compatibilityMode = Boolean(input.acceptPage);
  // A valid baseline is not an authored application. Preserve terminal provider
  // failures instead of accepting the untouched reference source or retrying it.
  const terminalAuthoringFailure = authored.outcomes.some((outcome) =>
    outcome.status !== 'authored' && ['credits', 'denied', 'provider', 'rate_limited', 'invalid_response', 'aborted'].includes(outcome.reason));
  const validateClosure = async (files: Record<string, string>) => {
    const report = await validateAppBuildCandidate({ contract: input.contract, files, initialFiles: baseFiles });
    const bindingIssues = unresolvedMarkerBindingIds.map((bindingId) => ({
      severity: 'blocker' as const,
      code: 'binding-marker-unresolved',
      path: input.contract.business.intentBindings.find((binding) => binding.bindingId === bindingId)?.route,
      message: `Canonical binding ${bindingId} has no matching generated control in its registered page surface.`,
    }));
    const pageIssues = pages.flatMap((page) =>
      (input.pageCheck?.(page.filePath, files[page.filePath] ?? '', files) ?? []).map((message) => ({
        severity: 'blocker' as const, code: 'page-contract', path: page.filePath, message,
      })));
    return {
      ...report,
      ok: report.ok && pageIssues.length === 0 && bindingIssues.length === 0,
      issues: [...report.issues, ...bindingIssues, ...pageIssues],
    };
  };
  const markerRequirements = input.contract.business.intentBindings
    .filter((binding) => binding.missingCapabilities.length === 0 && binding.ctaMarkers.length > 0)
    .map((binding) => {
      const targetPage = binding.targetType === 'page'
        ? input.contract.topology.pageRegistry.pages[binding.targetId]
        : undefined;
      return {
        bindingId: binding.bindingId,
        pageId: binding.pageId,
        sourceLabel: binding.sourceLabel,
        sourceSection: binding.sourceSection,
        sourceSlot: binding.sourceSlot,
        domIntent: binding.domIntent,
        targetType: binding.targetType,
        targetId: binding.targetId,
        targetPath: targetPage?.path ?? (binding.targetType === 'url' ? binding.targetId : undefined),
        markers: binding.ctaMarkers,
      };
    });
  const normalizeCandidateFiles = (files: Record<string, string>) => {
    const materialized = materializeRegisteredComponents(input.contract, files).files;
    const markerNormalization = normalizeWizardBindingMarkers(
      materialized,
      input.contract.topology.pageRegistry,
      markerRequirements,
    );
    unresolvedMarkerBindingIds = markerNormalization.unresolvedBindingIds;
    return materializeAppBuilderSectionModels(markerNormalization.files, pages.map((page) => ({
      id: page.pageId,
      filePath: page.filePath,
      route: page.route,
    })), sectionImplementations, generation.designSources.eligibleByPage);
  };
  let candidateFiles = { ...authored.files };
  if (!compatibilityMode && input.preflight) candidateFiles = input.preflight(candidateFiles);
  candidateFiles = normalizeCandidateFiles(candidateFiles);
  let closure = await validateClosure(candidateFiles);
  let closureRepairAttempts = 0;

  // One site-wide repair attempt sees the complete closure diagnostics and protected-path constraints.
  const closureTimeLeftMs = startedAt + totalBudgetMs - Date.now();
  if (!compatibilityMode && !terminalAuthoringFailure && !closure.ok && !input.signal?.aborted && closureTimeLeftMs >= MIN_CLOSURE_REPAIR_MS) {
    const closureRepairTimeoutMs = Math.min(closureTimeLeftMs, MAX_CLOSURE_REPAIR_MS);
    input.onStatus?.('Repairing final checks (up to 1:30)');
    const home = pages.find((page) => page.pageId === input.contract.topology.sitePlan.homePageId) ?? pages[0];
    if (home) {
      const diagnostics = closure.issues
        .filter((issue) => issue.severity === 'blocker')
        .map((issue) => `${issue.code}${issue.path ? ` (${issue.path})` : ''}: ${issue.message}`)
        .slice(0, 30);

      // Enhanced repair instruction for protected-path violations
      const hasProtectedPathViolation = diagnostics.some(d => d.includes('protected-source-changed'));
      const repairInstruction = hasProtectedPathViolation
        ? 'Resolve every supplied closure diagnostic across the candidate application. IMPORTANT: Do not modify package.json, tsconfig.json, or .unison/* files — these are canonical infrastructure. Reuse available runtime dependencies where they fit; you may import another valid browser npm package and the shared resolver will add and verify it. If that install or build fails, report the precise technical error. Never import Node builtins, server-only packages, or bypass capability facades.'
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
        runtimeContext: [input.runtimeContext, generation.runtimeContext].filter(Boolean).join('\n').slice(0, 12000),
        diagnostics,
      });
      const repaired = await dependencies.runComposer({
        request: assembled.request,
        baseFiles: candidateFiles,
        baseRevisionId: input.baseRevisionId ?? undefined,
        maxAttempts: 2,
        signal: input.signal,
        timeoutMs: closureRepairTimeoutMs,
        gatewayOptions: input.gatewayOptions,
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
        candidateFiles = normalizeCandidateFiles(candidateFiles);
        closure = await validateClosure(candidateFiles);
      }
    }
  }

  const cancelled = input.signal?.aborted === true;
  const ready = !terminalAuthoringFailure && (compatibilityMode || closure.ok);
  const authorDiagnostics = authored.outcomes.flatMap((outcome) => outcome.errors);
  const closureDiagnostics = closure.issues
    .filter((issue) => issue.severity === 'blocker')
    .map((issue) => issue.message);
  const strategy = compatibilityMode
    ? 'legacy-commit-adapter' as const
    : closureRepairAttempts > 0
      ? 'ai-candidate+closure-repair' as const
      : 'ai-candidate' as const;
  const graph = buildSystemGraph({
    files: candidateFiles,
    pageIdentities: input.contract.topology.sitePlan.pages.map((page) => ({
      id: page.id, path: page.route, filePath: page.filePath, title: page.title, role: page.role,
    })),
  });
  const candidate = {
    candidateId: `${input.operationId}:candidate:${closure.sourceHash.replace(':', '_')}`,
    status: cancelled ? 'cancelled' as const : ready ? 'ready-for-commit' as const : 'rejected' as const,
    files: candidateFiles,
    entryPoint: input.entryPoint,
    attempts: authored.outcomes.reduce((total, outcome) => total + outcome.attempts, 0) + closureRepairAttempts,
    diagnostics: [...authorDiagnostics, ...closureDiagnostics],
    closure,
    graph,
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
  input.onStatus?.(ready ? 'Preparing accepted template' : 'Finishing App Builder diagnostics');
  return {
    operationId: input.operationId,
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    candidate,
    candidateFiles,
    stopReason: cancelled ? 'cancelled' : ready ? 'complete' : terminalAuthoringFailure ? 'provider-error' : closureRepairAttempts ? 'repair-exhausted' : 'validation-failed',
    outcomes: authored.outcomes,
    revisionId: authored.revisionId,
  };
}
