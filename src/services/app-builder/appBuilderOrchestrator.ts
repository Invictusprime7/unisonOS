/** Candidate-only full-application orchestration behind UnisonAppBuilder. */

import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import type { ComposerLoopInput, ComposerLoopResult, ComposerStopReason } from '@/services/builder/aiRepairLoop';
import type { AuthoringPage, SiteAuthoringInput, SiteAuthoringResult } from '@/services/launch/siteAuthoringOrchestrator';
import { APP_BUILDER_PROTOCOL_VERSION, type AppBuildRequest, type AppBuildResult } from './appBuilderContracts';
import { findDesignSourceUsageIssues, validateAppBuildCandidate } from './appBuilderCandidate';
import { materializeRegisteredComponents } from './registeredComponentMaterializer';
import { evaluateDesignQuality } from './design/designQualityClosure';
import { applyDesignSources } from './design/designSourceMaterializer';
import { materializeAppBuilderSiteShell } from './design/appBuilderSiteShell';
import { materializeDeterministicAppBuilderScaffold } from './design/appBuilderScaffold';
import { buildAppBuilderGenerationContext, renderHomeObjectContext, reportDesignSourceUsage } from './appBuilderGenerationContext';
import { findPageStructureIssues, pageStructureRequirement, verifiedPhotosFor } from './design/pageStructureGate';
import type { ContentTypeRow } from '@/services/resources/resourceRegistry';
import { normalizeWizardBindingMarkers } from '@/services/wizardBindingBridge';
import {
  getAppBuilderSharedShellImplementationIds,
  materializeAppBuilderSectionModelsWithDiagnostics,
  type AppBuilderSectionMaterializationResult,
} from './appBuilderSectionModel';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';
import { resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';
import { sectionSiteBudgetMs } from '@/services/launch/sectionAuthoringInvoke';
import { closureRepairTargets } from './closureRepairTargets';
import { isBindingOperationallyPending } from './bindingAvailability';
import { pageCompositionCoverage } from './pageCompositionCoverage';

export interface AppBuilderOrchestratorDependencies {
  authorSite: (input: SiteAuthoringInput) => Promise<SiteAuthoringResult>;
  runComposer: (input: ComposerLoopInput) => Promise<ComposerLoopResult>;
  loadContentTypes?: (scope: { businessId: string; projectId: string }) => Promise<ContentTypeRow[]>;
}

const CLOSURE_REPAIR_RESERVE_MS = 75_000;
const MAX_CLOSURE_REPAIR_MS = 90_000;
// Each source-owner repair gets a usable provider window, never all site pages.
const MIN_CLOSURE_REPAIR_MS = 60_000;

export async function orchestrateAppBuild(
  input: AppBuildRequest,
  dependencies: AppBuilderOrchestratorDependencies,
): Promise<AppBuildResult> {
  const generationMode = input.generationMode ?? 'ai';
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
  const orderedPages = [...pages].sort((a, b) => Number(b.route === '/') - Number(a.route === '/') || a.route.localeCompare(b.route));
  const totalBudgetMs = input.budgetMs ?? sectionSiteBudgetMs(orderedPages.map(page =>
    input.contract.design.compositionPlan.pages.find(planned => planned.pageId === page.pageId)?.target.sectionOrder ?? []), input.concurrency);
  const authoringBudgetMs = Math.max(60_000, totalBudgetMs - CLOSURE_REPAIR_RESERVE_MS);
  let contentTypes: ContentTypeRow[] = [];
  if (generationMode === 'ai' && dependencies.loadContentTypes && input.baseRevisionId) {
    try {
      contentTypes = await dependencies.loadContentTypes({
        businessId: input.contract.identity.businessId,
        projectId: input.contract.identity.projectId,
      });
    } catch (error) {
      // CMS schemas enrich authoring only; the accepted revision proves the
      // project scope exists before requesting optional schema hints.
      console.warn('[AppBuilder] Content-type context unavailable; continuing without CMS schema hints.', error);
    }
  }
  const generation = buildAppBuilderGenerationContext(input.contract, contentTypes);
  const baseFiles = {
    ...applyDesignSources(input.initialFiles, generation.materialization),
    ...materializeAppBuilderSiteShell({
      registry: input.contract.topology.pageRegistry,
      businessName: input.contract.business.businessName,
      bundle: generation.designSources,
      materialization: generation.materialization,
    }),
  };
  const manifestSource = baseFiles['/.unison/design-source-manifest.json'];
  const contractPages = input.contract.design.resolvedSiteDesignContext.contract.pages;
  const roleByPath = new Map(pages.map((page) => [page.filePath, page.role]));
  const sectionImplementations = generation.materialization.manifest.implementations;
  const sharedShellImplementationIds = getAppBuilderSharedShellImplementationIds(baseFiles, sectionImplementations);
  const photoUrls = verifiedPhotosFor(input.contract.design.resolvedSiteDesignContext?.contract.industry ?? input.contract.business.industry);
  let unresolvedMarkerBindingIds: string[] = [];
  let systemMaterializedCompositionFiles: Record<string, string> = {};
  let latestSectionMaterialization: AppBuilderSectionMaterializationResult | undefined;
  let closureRepairFailure: { reason: ComposerStopReason; errors: string[] } | undefined;
  const markerRequirements = input.contract.business.intentBindings
    .filter((binding) => !isBindingOperationallyPending(input.contract, binding) && binding.ctaMarkers.length > 0)
    .map((binding) => {
      const targetPage = binding.targetType === 'page'
        ? input.contract.topology.pageRegistry.pages[binding.targetId]
        : undefined;
      return {
        bindingId: binding.bindingId, pageId: binding.pageId, sourceLabel: binding.sourceLabel,
        sourceSection: binding.sourceSection, sourceSlot: binding.sourceSlot, domIntent: binding.domIntent,
        targetType: binding.targetType, targetId: binding.targetId,
        targetPath: targetPage?.path ?? (binding.targetType === 'url' ? binding.targetId : undefined),
        markers: binding.ctaMarkers,
      };
    });
  const projectPage = (files: Readonly<Record<string, string>>, page: AuthoringPage) => {
    const bindings = input.contract.business.intentBindings.filter(binding => binding.pageId === page.pageId);
    const scopedContract = {
      ...input.contract,
      topology: { ...input.contract.topology, sitePlan: { ...input.contract.topology.sitePlan,
        pages: input.contract.topology.sitePlan.pages.filter(target => target.id === page.pageId) } },
      business: { ...input.contract.business, intentBindings: bindings,
        registeredComponents: input.contract.business.registeredComponents.filter(component =>
          component.runtime.usedOnPages.includes(page.pageId)
          || bindings.some(binding => binding.componentInstanceId === component.runtime.instanceId)),
      },
    };
    const materialized = materializeRegisteredComponents(scopedContract, files).files;
    const markers = normalizeWizardBindingMarkers(materialized, input.contract.topology.pageRegistry,
      markerRequirements.filter(binding => binding.pageId === page.pageId));
    const sections = materializeAppBuilderSectionModelsWithDiagnostics(markers.files,
      [{ id: page.pageId, filePath: page.filePath, route: page.route }], sectionImplementations,
      generation.designSources.eligibleByPage, sharedShellImplementationIds);
    return { files: sections.files, errors: [
      ...markers.unresolvedBindingIds.map(id => `Canonical binding ${id} has no matching generated control on ${page.filePath}.`),
      ...sections.diagnostics.map(diagnostic => diagnostic.message),
      ...sections.pages.flatMap(result => pageCompositionCoverage(
        input.contract.design.compositionPlan.pages.find(planned => planned.pageId === page.pageId), result)),
    ] };
  };
  const pageCheck = (path: string, source: string, files?: Readonly<Record<string, string>>) => {
    const messages = findDesignSourceUsageIssues(manifestSource, source).map((issue) => issue.message);
    const page = pages.find((candidate) => candidate.filePath === path);
    const sectionResult = materializeAppBuilderSectionModelsWithDiagnostics(
      { ...(files ?? {}), [path]: source },
      [{ id: page?.pageId ?? path, filePath: path, route: page?.route }],
      sectionImplementations,
      generation.designSources.eligibleByPage,
      sharedShellImplementationIds,
    );
    messages.push(...sectionResult.diagnostics.map((diagnostic) => diagnostic.message));
    if (page) messages.push(...projectPage({ ...baseFiles, ...files, [path]: source }, page).errors);
    messages.push(...(input.pageCheck?.(path, source, files) ?? []));
    const role = roleByPath.get(path);
    if (role) {
      const requirement = pageStructureRequirement(role, contractPages[role]?.densityBudget?.min, photoUrls);
      messages.push(...findPageStructureIssues(path, source, files ?? { [path]: source }, requirement));
    }
    return messages;
  };
  const authored = generationMode === 'deterministic'
    ? {
      files: {
        ...baseFiles,
        ...materializeDeterministicAppBuilderScaffold(input.contract, {
          implementations: generation.materialization.manifest.implementations,
          eligibleByPage: generation.designSources.eligibleByPage,
        }),
      },
      outcomes: [],
    }
    : await dependencies.authorSite({
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
    runtimeContextForPage: (pageId, files, homePageId) => [
      homePageId && homePageId !== pageId ? renderHomeObjectContext(input.contract, files, homePageId) : '',
      input.runtimeContext, generation.runtimeContextForPage(pageId),
    ].filter(Boolean).join('\n'),
    preparePage: (files, page) => {
      const projected = projectPage(files, page);
      if (projected.errors.length) throw new Error(projected.errors.join('\n'));
      const sidecarPath = resolvedCompositionPathFor(page.filePath);
      systemMaterializedCompositionFiles[sidecarPath] = projected.files[sidecarPath];
      return projected.files;
    },
    pageCheck,
    reuseAcceptedPages: input.reuseAcceptedPages ?? true,
    resolveDependencies: false,
  });
  input.onStatus?.(generationMode === 'deterministic'
    ? 'Checking deterministic starter pages, sections and bindings'
    : 'Checking authored pages, sections and bindings');

  const compatibilityMode = Boolean(input.acceptPage);
  // A valid baseline is not an authored application. Preserve terminal provider
  // failures instead of accepting the untouched reference source or retrying it.
  const terminalAuthoringFailure = authored.outcomes.some((outcome) =>
    outcome.status !== 'authored' && ['credits', 'denied', 'provider', 'rate_limited', 'invalid_response', 'aborted'].includes(outcome.reason));
  const missingAuthorship = generationMode === 'ai' ? pages.filter(page =>
    !authored.outcomes.some(outcome => outcome.page.pageId === page.pageId && outcome.status === 'authored')) : [];
  const incompleteAuthoring = missingAuthorship.length > 0;
  const validateClosure = async (files: Record<string, string>) => {
    const report = await validateAppBuildCandidate({
      contract: input.contract,
      files,
      initialFiles: baseFiles,
      systemMaterializedCompositionFiles,
      requireAppBuilderSectionModels: true,
    });
    const bindingIssues = unresolvedMarkerBindingIds.map((bindingId) => ({
      severity: 'blocker' as const,
      code: 'binding-marker-unresolved',
      path: input.contract.business.intentBindings.find((binding) => binding.bindingId === bindingId)?.route,
      message: `Canonical binding ${bindingId} has no matching generated control in its registered page surface.`,
    }));
    const sectionModelIssues = (latestSectionMaterialization?.diagnostics ?? []).map((diagnostic) => ({
      severity: 'blocker' as const,
      code: diagnostic.code,
      path: diagnostic.path,
      message: diagnostic.message,
    }));
    const coverageIssues = (latestSectionMaterialization?.pages ?? []).flatMap(page =>
      pageCompositionCoverage(input.contract.design.compositionPlan.pages.find(planned => planned.pageId === page.pageId), page)
        .map(message => ({ severity: 'blocker' as const, code: 'page-composition-incomplete', path: page.filePath, message })));
    const authorshipIssues = missingAuthorship.map(page => ({ severity: 'blocker' as const,
      code: 'ai-page-not-authored', path: page.filePath,
      message: `${page.title} has no completed AI authorship; a baseline cannot count as an AI-enriched page.` }));
    const pageIssues = pages.flatMap((page) =>
      (generationMode === 'deterministic'
        ? pageCheck(page.filePath, files[page.filePath] ?? '', files)
        : input.pageCheck?.(page.filePath, files[page.filePath] ?? '', files) ?? []).map((message) => ({
        severity: 'blocker' as const, code: 'page-contract', path: page.filePath, message,
      })));
    return {
      ...report,
      ok: report.ok && pageIssues.length === 0 && bindingIssues.length === 0 && sectionModelIssues.length === 0 && coverageIssues.length === 0 && authorshipIssues.length === 0,
      issues: [...report.issues, ...bindingIssues, ...sectionModelIssues, ...coverageIssues, ...authorshipIssues, ...pageIssues],
    };
  };
  const normalizeCandidateFiles = (files: Record<string, string>) => {
    const materialized = materializeRegisteredComponents(input.contract, files).files;
    const markerNormalization = normalizeWizardBindingMarkers(
      materialized,
      input.contract.topology.pageRegistry,
      markerRequirements,
    );
    unresolvedMarkerBindingIds = markerNormalization.unresolvedBindingIds;
    const beforeSectionMaterialization = markerNormalization.files;
    const sectionResult = materializeAppBuilderSectionModelsWithDiagnostics(beforeSectionMaterialization, pages.map((page) => ({
      id: page.pageId,
      filePath: page.filePath,
      route: page.route,
    })), sectionImplementations, generation.designSources.eligibleByPage, sharedShellImplementationIds);
    latestSectionMaterialization = sectionResult;
    const generatedSidecars: Record<string, string> = {};
    for (const page of pages) {
      const path = resolvedCompositionPathFor(page.filePath);
      const sidecar = sectionResult.files[path];
      if (typeof sidecar !== 'string' || sidecar === baseFiles[path]) continue;
      const unchangedSystemOutput = systemMaterializedCompositionFiles[path] === beforeSectionMaterialization[path];
      if (sidecar !== beforeSectionMaterialization[path] || unchangedSystemOutput) generatedSidecars[path] = sidecar;
    }
    systemMaterializedCompositionFiles = generatedSidecars;
    return sectionResult.files;
  };
  let candidateFiles = { ...authored.files };
  if (!compatibilityMode && input.preflight) candidateFiles = input.preflight(candidateFiles);
  candidateFiles = normalizeCandidateFiles(candidateFiles);
  let closure = await validateClosure(candidateFiles);
  let closureRepairAttempts = 0;

  if (generationMode === 'ai' && !compatibilityMode && !terminalAuthoringFailure && !incompleteAuthoring) {
    const attemptedTargets = new Set<string>();
    while (!closure.ok && !input.signal?.aborted && !closureRepairFailure) {
      const closureTimeLeftMs = startedAt + totalBudgetMs - Date.now();
      if (closureTimeLeftMs < MIN_CLOSURE_REPAIR_MS) break;
      const group = closureRepairTargets(candidateFiles, pages, closure.issues)
        .find(group => !attemptedTargets.has(group.target));
      if (!group) break;
      attemptedTargets.add(group.target);
      const closureRepairTimeoutMs = Math.min(closureTimeLeftMs, MAX_CLOSURE_REPAIR_MS);
      input.onStatus?.('Repairing final checks (up to 1:30)');
      const repairInstruction = `Fix only the supplied diagnostics owned by ${group.target}. Preserve all completed pages, section identities, content, images and intent bindings. Prefer <<<EDIT SEARCH/REPLACE hunks copied exactly from FILES for existing files; the server applies them into complete source. Do not rewrite the whole page for a small layout fix. Other supplied files are read-only. You may create a missing project-local module required by these diagnostics. Never change routes, canonical infrastructure or capability permissions.`;
      const assembled = await assembleCanonicalAuthoringRequest({
        task: 'site_page_repair',
        page: group.page,
        brief: 'Repair the reported source-owner checks without changing the sealed design identity or other completed pages.',
        knowledgeQuery: `${input.contract.business.industry} ${group.page.role} module design closure`,
        instruction: repairInstruction,
        baseFiles: candidateFiles,
        baseRevisionId: input.baseRevisionId,
        sourceTargets: [group.target],
        sourceScope: { scoped: true },
        routes: pages.map((page) => ({ title: page.title, route: page.route })),
        registryContext: input.contract.design.registryContext,
        runtimeContext: [input.runtimeContext, generation.runtimeContextForPage(group.page.pageId)].filter(Boolean).join('\n').slice(0, 12000),
        diagnostics: group.diagnostics.slice(0, 30),
      });
      if (!assembled.evidence.sourceContextComplete) break;
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
      closureRepairAttempts += repaired.attempts;
      if (!repaired.ok && ['credits', 'denied', 'rate_limited', 'provider', 'invalid_response', 'aborted'].includes(repaired.reason)) {
        closureRepairFailure = { reason: repaired.reason, errors: repaired.errors };
      }
      if (repaired.ok && repaired.prepared) {
        const unrelatedChanges = Object.keys({ ...candidateFiles, ...repaired.prepared.nextFiles }).filter(path =>
          path.startsWith('/src/') && path !== group.target && candidateFiles[path] !== undefined
          && candidateFiles[path] !== repaired.prepared?.nextFiles[path]);
        if (unrelatedChanges.length) {
          closureRepairFailure = { reason: 'invalid_response', errors: [`Final-check repair changed read-only source: ${unrelatedChanges.join(', ')}`] };
          break;
        }
        candidateFiles = repaired.prepared.nextFiles;
        if (input.preflight) candidateFiles = input.preflight(candidateFiles);
        candidateFiles = normalizeCandidateFiles(candidateFiles);
        closure = await validateClosure(candidateFiles);
      }
    }
  }

  const cancelled = input.signal?.aborted === true;
  const sectionModelsValid = Boolean(
    latestSectionMaterialization
    && latestSectionMaterialization.diagnostics.length === 0
    && latestSectionMaterialization.pages.length === pages.length
    && latestSectionMaterialization.pages.every((page) => typeof page.sidecarContents === 'string'),
  );
  const ready = !incompleteAuthoring && !terminalAuthoringFailure && !closureRepairFailure && sectionModelsValid
    && (compatibilityMode || closure.ok);
  const authorDiagnostics = authored.outcomes.flatMap((outcome) => outcome.errors);
  const closureDiagnostics = closure.issues
    .filter((issue) => issue.severity === 'blocker')
    .map((issue) => issue.message);
  const surfacedDiagnostics = terminalAuthoringFailure
    ? authorDiagnostics
    : [...(closureRepairFailure?.errors ?? []), ...authorDiagnostics, ...closureDiagnostics,
      ...closure.issues.filter(issue => issue.severity === 'advisory').map(issue => issue.message)];
  const strategy = generationMode === 'deterministic'
    ? 'deterministic-scaffold' as const
    : compatibilityMode
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
    diagnostics: surfacedDiagnostics,
    closure,
    graph,
    provenance: {
      protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
      operationId: input.operationId,
      baseRevisionId: input.baseRevisionId ?? null,
      contractSeed: input.contract.design.seed,
      sourceHash: closure.sourceHash,
      authoredPageIds: generationMode === 'ai' ? authored.outcomes.filter(outcome => outcome.status === 'authored').map(outcome => outcome.page.pageId) : [],
      strategy,
    },
  };
  input.onStatus?.(ready ? 'Preparing accepted template' : 'Finishing App Builder diagnostics');
  return {
    operationId: input.operationId,
    protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
    candidate,
    candidateFiles,
    stopReason: cancelled ? 'cancelled' : ready ? 'complete' : terminalAuthoringFailure || closureRepairFailure ? 'provider-error' : closureRepairAttempts ? 'repair-exhausted' : 'validation-failed',
    outcomes: authored.outcomes,
    revisionId: authored.revisionId,
  };
}
