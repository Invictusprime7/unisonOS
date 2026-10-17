/**
 * Product-level authoring facade shared by fresh launch and Builder edits.
 *
 * M2 intentionally adapts the proven page orchestrator and Composer repair
 * loop. Provider transport remains behind those services, and every returned
 * source mutation has passed the existing candidate gates.
 */

import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
import { buildAICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import {
  runComposerRepairLoop,
  type ComposerLoopInput,
  type ComposerLoopResult,
} from '@/services/builder/aiRepairLoop';
import {
  authorSitePages,
  type SiteAuthoringInput,
  type SiteAuthoringResult,
} from '@/services/launch/siteAuthoringOrchestrator';
import {
  APP_BUILDER_PROTOCOL_VERSION,
  type AppBuildCandidateStopReason,
  type AppBuildRequest,
  type AppBuildResult,
  type AppEditRequest,
  type AppEditResult,
  type AppBuilderPageGenerationRequest,
  type AppBuilderPageGenerationResult,
  type AppRepairRequest,
} from './appBuilderContracts';
import { orchestrateAppBuild } from './appBuilderOrchestrator';
import { createUnisonBuilderContext, renderUnisonBuilderDirective } from '@/services/unisonBuilderConnector';
import { resolveBuilderRegistryContext } from '@/services/builderRegistryContext';

export interface UnisonAppBuilder {
  generate(input: AppBuildRequest): Promise<AppBuildResult>;
  generatePages(input: AppBuilderPageGenerationRequest): Promise<AppBuilderPageGenerationResult>;
  edit(input: AppEditRequest): Promise<AppEditResult>;
  repair(input: AppRepairRequest): Promise<AppEditResult>;
}

export interface UnisonAppBuilderDependencies {
  authorSite?: (input: SiteAuthoringInput) => Promise<SiteAuthoringResult>;
  runComposer?: (input: ComposerLoopInput) => Promise<ComposerLoopResult>;
}

function stopReason(reason: ComposerLoopResult['reason']): AppBuildCandidateStopReason {
  switch (reason) {
    case 'accepted': return 'complete';
    case 'gates_exhausted': return 'repair-exhausted';
    case 'aborted': return 'cancelled';
    case 'provider':
    case 'credits':
    case 'denied':
    case 'rate_limited': return 'provider-error';
    default: return 'validation-failed';
  }
}

export function createUnisonAppBuilder(
  dependencies: UnisonAppBuilderDependencies = {},
): UnisonAppBuilder {
  const authorSite = dependencies.authorSite ?? authorSitePages;
  const runComposer = dependencies.runComposer ?? runComposerRepairLoop;

  const service: UnisonAppBuilder = {
    async generate(input) {
      return orchestrateAppBuild(input, { authorSite, runComposer });
    },

    async generatePages(input) {
      const connector = createUnisonBuilderContext({
        ...input.connectorContext,
        files: input.currentFiles,
        revisionId: input.baseRevisionId,
        // New pages belong to approved route operations, not existing-source targets.
        registryContext: input.connectorContext?.registryContext ?? resolveBuilderRegistryContext({ vfsFiles: { ...input.currentFiles }, industry: input.industry }),
        sourceTargets: [],
      });
      const reject = (diagnostics: string[]): AppBuilderPageGenerationResult => ({
        operationId: input.operationId,
        protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
        baseRevisionId: input.baseRevisionId,
        status: input.signal?.aborted ? 'cancelled' : 'rejected',
        stopReason: input.signal?.aborted ? 'cancelled' : 'validation-failed',
        candidateFiles: { ...input.currentFiles },
        routeOps: [],
        outcomes: [],
        diagnostics,
      });
      if (input.pages.length === 0 || input.pages.length > 12) {
        return reject(['Page generation requires between 1 and 12 page targets.']);
      }
      const pageIds = new Set<string>();
      const routes = new Set((input.existingRoutes ?? []).map(({ route }) => normalizeRoute(route)));
      const filePaths = new Set<string>();
      for (const page of input.pages) {
        const route = normalizeRoute(page.route);
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(page.pageId) || pageIds.has(page.pageId)) {
          return reject([`Duplicate or invalid page ID: ${page.pageId}`]);
        }
        if (!page.title.trim() || page.title.length > 120) return reject([`Invalid page title for ${page.pageId}.`]);
        if (!/^\/[A-Za-z0-9/_-]*$/.test(route) || route === '/' || route.includes('//')) {
          return reject([`Invalid new page route: ${page.route}`]);
        }
        if (routes.has(route)) return reject([`Route already exists: ${route}`]);
        if (!/^\/src\/pages\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.tsx?$/.test(page.filePath)) {
          return reject([`${page.filePath}: generated pages must be TypeScript files under /src/pages/.`]);
        }
        if (filePaths.has(page.filePath) || input.currentFiles[page.filePath] !== undefined) {
          return reject([`${page.filePath}: page generation cannot replace an existing file.`]);
        }
        pageIds.add(page.pageId);
        routes.add(route);
        filePaths.add(page.filePath);
      }
      const routeOps = input.pages.map((page) => ({
        type: 'add_page' as const,
        pageId: page.pageId,
        title: page.title,
        route: page.route,
        pageType: page.pageType,
        showInNav: page.showInNav,
        navOrder: page.navOrder,
        createdBy: 'ai' as const,
      }));
      const authored = await authorSite({
        pages: input.pages.map(({ pageId, title, route, filePath, role }) => ({ pageId, title, route, filePath, role })),
        designContext: input.designContext ?? null,
        industry: input.industry,
        existingRoutes: input.existingRoutes,
        businessName: input.businessName,
        visionBrief: input.visionBrief,
        files: { ...input.currentFiles },
        revisionId: input.baseRevisionId,
        candidateOrigin: 'builder',
        initialRouteOps: routeOps,
        registryContext: input.registryContext,
        runtimeContext: [renderUnisonBuilderDirective(connector), input.runtimeContext].filter(Boolean).join('\n'),
        signal: input.signal,
        budgetMs: input.budgetMs,
        concurrency: input.concurrency,
        onProgress: input.onProgress,
        resolveDependencies: false,
        commitPage: async (files) => ({ files, revisionId: input.baseRevisionId }),
      });
      const diagnostics = authored.outcomes.flatMap((outcome) => outcome.errors);
      const complete = authored.outcomes.length === input.pages.length
        && authored.outcomes.every((outcome) => outcome.status === 'authored');
      if (!complete) {
        return {
          operationId: input.operationId,
          protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
          baseRevisionId: input.baseRevisionId,
          status: input.signal?.aborted ? 'cancelled' : 'rejected',
          stopReason: input.signal?.aborted ? 'cancelled' : 'provider-error',
          candidateFiles: authored.files,
          routeOps: [],
          outcomes: authored.outcomes,
          diagnostics: diagnostics.length ? diagnostics : ['Not every requested page was authored.'],
        };
      }
      const changeSet = buildAICandidateChangeSet({
        aiFiles: authored.files,
        baseFiles: { ...input.currentFiles },
        baseRevisionId: input.baseRevisionId ?? undefined,
        targetPages: input.pages.map((page) => page.filePath),
        origin: 'builder',
        intent: 'in-builder-multi-page-generation',
        routeOps,
        resolveDependencies: false,
      }).changeSet;
      return {
        operationId: input.operationId,
        protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
        baseRevisionId: input.baseRevisionId,
        status: 'ready-for-commit',
        stopReason: 'complete',
        candidateFiles: authored.files,
        changeSet,
        routeOps,
        outcomes: authored.outcomes,
        diagnostics,
      };
    },

    async edit(input) {
      const connector = createUnisonBuilderContext({
        ...input.connectorContext,
        files: input.currentFiles,
        revisionId: input.baseRevisionId,
        sourceTargets: input.sourceTargets,
        registryContext: input.connectorContext?.registryContext ?? resolveBuilderRegistryContext({ vfsFiles: { ...input.currentFiles }, pageRole: input.page.role }),
      });
      const assembled = await assembleCanonicalAuthoringRequest({
        task: 'builder_source_edit',
        page: input.page,
        brief: input.brief ?? 'Edit the accepted React project without changing unrelated source.',
        knowledgeQuery: input.knowledgeQuery ?? `${input.instruction} ${input.page.role}`,
        instruction: input.instruction.slice(0, 4000),
        baseFiles: { ...input.currentFiles },
        baseRevisionId: input.baseRevisionId ?? undefined,
        sourceTargets: [...input.sourceTargets],
        approvedRouteOps: input.initialRouteOps,
        routes: [...(input.routes ?? [])],
        registryContext: input.registryContext,
        runtimeContext: [renderUnisonBuilderDirective(connector), input.runtimeContext].filter(Boolean).join('\n'),
        attachmentContext: input.attachmentContext,
        images: input.images,
        diagnostics: input.diagnostics ? [...input.diagnostics] : undefined,
      });
      if (!assembled.evidence.sourceContextComplete) {
        const diagnostics = [
          ...assembled.evidence.omittedSourcePaths.map(path => `Source unavailable within the request budget: ${path}`),
          ...assembled.evidence.unresolvedImports.map(path => `Unresolved source import: ${path}`),
        ];
        return {
          operationId: input.operationId,
          protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
          baseRevisionId: input.baseRevisionId,
          candidate: { candidateId: `${input.operationId}:candidate`, status: 'rejected', files: input.currentFiles, entryPoint: input.page.filePath, attempts: 0, diagnostics },
          candidateFiles: input.currentFiles,
          stopReason: 'validation-failed',
        };
      }
      const composer = await runComposer({
        request: assembled.request,
        baseFiles: { ...input.currentFiles },
        baseRevisionId: input.baseRevisionId ?? undefined,
        maxAttempts: 3,
        signal: input.signal,
        timeoutMs: input.timeoutMs,
        gatewayOptions: input.gatewayOptions,
        preflight: input.preflight,
        initialRouteOps: input.initialRouteOps,
        candidateOrigin: input.diagnostics?.length ? 'repair' : 'builder',
        candidateIntent: input.instruction.slice(0, 240),
      });
      const accepted = composer.ok && composer.prepared;
      return {
        operationId: input.operationId,
        protocolVersion: APP_BUILDER_PROTOCOL_VERSION,
        baseRevisionId: input.baseRevisionId,
        candidate: {
          candidateId: composer.prepared?.build.changeSet.id ?? `${input.operationId}:candidate`,
          status: accepted ? 'ready-for-commit' : composer.reason === 'aborted' ? 'cancelled' : 'rejected',
          files: composer.prepared?.nextFiles ?? input.currentFiles,
          entryPoint: input.page.filePath,
          attempts: composer.attempts,
          diagnostics: composer.errors,
        },
        candidateFiles: composer.prepared?.nextFiles ?? input.currentFiles,
        stopReason: stopReason(composer.reason),
        changeSet: composer.prepared?.build.changeSet,
        summary: composer.response?.summary,
      };
    },

    repair(input) {
      return service.edit(input);
    },
  };
  return service;
}

export const unisonAppBuilder = createUnisonAppBuilder();

export default unisonAppBuilder;

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed.startsWith('/') || /[?#\s]/.test(trimmed)) return trimmed;
  return (trimmed.replace(/\/+$/, '') || '/').toLowerCase();
}
