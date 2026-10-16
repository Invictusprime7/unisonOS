/**
 * Product-level authoring facade shared by fresh launch and Builder edits.
 *
 * M2 intentionally adapts the proven page orchestrator and Composer repair
 * loop. Provider transport remains behind those services, and every returned
 * source mutation has passed the existing candidate gates.
 */

import { assembleCanonicalAuthoringRequest } from '@/services/builder/canonicalAuthoringRequest';
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
  type AppRepairRequest,
} from './appBuilderContracts';
import { orchestrateAppBuild } from './appBuilderOrchestrator';

export interface UnisonAppBuilder {
  generate(input: AppBuildRequest): Promise<AppBuildResult>;
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

    async edit(input) {
      const assembled = await assembleCanonicalAuthoringRequest({
        task: 'builder_source_edit',
        page: input.page,
        brief: input.brief ?? 'Edit the accepted React project without changing unrelated source.',
        knowledgeQuery: input.knowledgeQuery ?? `${input.instruction} ${input.page.role}`,
        instruction: input.instruction.slice(0, 4000),
        baseFiles: { ...input.currentFiles },
        baseRevisionId: input.baseRevisionId ?? undefined,
        sourceTargets: [...input.sourceTargets],
        routes: [...(input.routes ?? [])],
        registryContext: input.registryContext,
        runtimeContext: input.runtimeContext,
        diagnostics: input.diagnostics ? [...input.diagnostics] : undefined,
      });
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
